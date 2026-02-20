/**
 * Insights Data Aggregator
 *
 * Queries 14 days of user nutrition data from multiple tables,
 * computes summary metrics for the AI insights pipeline, and
 * generates a SHA-256 input hash for cache invalidation.
 *
 * Designed to be called from tRPC context (receives prisma as a parameter).
 */

import { createHash } from 'crypto';

import type { PrismaClient } from '@prisma/client';
import type { InsightsDataPayload } from '@/lib/insights/schemas';

import { toLocalDay, addDays } from '@/lib/date-utils';
import { calculateWeightTrend, fetchChronologicalWeightEntries } from '@/server/utils/weight-trend';
import { calculateAdherenceScore } from '@/server/utils/daily-log';
import { insightsLogger } from '@/server/utils/insights-logger';

// Re-export for test consumers that need the prisma type parameter
export type { PrismaClient } from '@prisma/client';

// Day name lookup indexed by JS getUTCDay() (0 = Sunday)
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// ---------------------------------------------------------------------------
// Main aggregation function
// ---------------------------------------------------------------------------

export async function aggregateInsightsData(
  prisma: PrismaClient,
  userId: string,
  windowDays = 14
): Promise<{ payload: InsightsDataPayload; inputHash: string }> {
  const startMs = performance.now();
  insightsLogger.aggregationStarted(windowDays);

  const today = toLocalDay();
  const windowStart = addDays(today, -windowDays);
  const weightWindowStart = addDays(today, -30);

  // ----- Parallel data fetches -----
  const [
    dailyLogs,
    trackedMeals,
    mealSwaps,
    weightEntries,
    _calorieAdjustments,
    activitySyncs,
    userProfile,
  ] = await Promise.all([
    // 1. Daily logs (last windowDays)
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: windowStart } },
      orderBy: { date: 'desc' },
    }),

    // 2. Tracked meals (last windowDays) - only the columns we need
    prisma.trackedMeal.findMany({
      where: { userId, loggedDate: { gte: windowStart } },
      select: { source: true, mealSlot: true, loggedDate: true },
    }),

    // 3. Meal swaps via user's active plans (last windowDays)
    prisma.mealSwap.findMany({
      where: {
        mealPlan: { userId, isActive: true },
        createdAt: { gte: windowStart },
      },
      select: { slot: true, createdAt: true },
    }),

    // 4. Weight entries (30-day window for trend calculation)
    // Cast required: fetchChronologicalWeightEntries declares a structural
    // prisma type whose findMany accepts Record<string, unknown>. The full
    // PrismaClient's findMany has a narrower, type-safe signature that
    // doesn't overlap structurally. Both are functionally compatible at
    // runtime, so the cast through unknown is safe here.
    fetchChronologicalWeightEntries(
      prisma as unknown as Parameters<typeof fetchChronologicalWeightEntries>[0],
      userId,
      { dateFilter: weightWindowStart }
    ),

    // 5. Calorie adjustments (last 30 days)
    prisma.calorieAdjustment.findMany({
      where: { userId, createdAt: { gte: weightWindowStart } },
      orderBy: { createdAt: 'desc' },
    }),

    // 6. Activity syncs (last windowDays)
    prisma.activitySync.findMany({
      where: { userId, syncDate: { gte: windowStart } },
    }),

    // 7. User profile (current active)
    prisma.userProfile.findFirst({
      where: { userId, isActive: true },
    }),
  ]);

  // ----- Pre-computed metrics -----

  // Adherence scores - use stored value if present, otherwise recalculate
  const adherenceScores = dailyLogs.map((log) => {
    if (log.adherenceScore !== null && log.adherenceScore !== undefined) return log.adherenceScore;
    return calculateAdherenceScore({
      actualKcal: log.actualKcal,
      actualProteinG: log.actualProteinG,
      actualCarbsG: log.actualCarbsG,
      actualFatG: log.actualFatG,
      targetKcal: log.targetKcal,
      targetProteinG: log.targetProteinG,
      targetCarbsG: log.targetCarbsG,
      targetFatG: log.targetFatG,
    });
  });

  const avgAdherence =
    adherenceScores.length > 0
      ? Math.round(adherenceScores.reduce((sum, s) => sum + s, 0) / adherenceScores.length)
      : 0;

  // Calorie and macro gaps
  const avgCalorieDeficit = safeAvg(dailyLogs.map((l) => l.actualKcal - (l.targetKcal ?? 0)));
  const avgProteinGap = safeAvg(dailyLogs.map((l) => l.actualProteinG - (l.targetProteinG ?? 0)));
  const avgCarbsGap = safeAvg(dailyLogs.map((l) => l.actualCarbsG - (l.targetCarbsG ?? 0)));
  const avgFatGap = safeAvg(dailyLogs.map((l) => l.actualFatG - (l.targetFatG ?? 0)));

  // Low-adherence count
  const daysWithLowAdherence = adherenceScores.filter((s) => s < 60).length;

  // Streak: consecutive days from most recent with adherenceScore >= 70
  // dailyLogs is ordered desc, so index 0 is the most recent
  const streakDays = computeStreak(adherenceScores, 70);

  // Best / worst day of week by average adherence
  const { bestDay, worstDay } = computeDayOfWeekExtremes(
    dailyLogs.map((log, i) => ({
      date: log.date,
      adherence: adherenceScores[i],
    }))
  );

  // Meal swap metrics
  const totalSwaps = mealSwaps.length;
  const frequentlySwappedSlots = computeFrequentSlots(mealSwaps, 3);

  // Plan meal percentage
  const totalMeals = trackedMeals.length;
  const planMealCount = trackedMeals.filter((m) => m.source === 'plan_meal').length;
  const planMealPct = totalMeals > 0 ? Math.round((planMealCount / totalMeals) * 100) : 0;

  // Weight trend
  const weightTrend = calculateWeightTrend(weightEntries);
  const weightTrendLbsPerWeek = weightTrend?.weeklyRateLbs ?? null;
  const isPlateau =
    weightTrend !== null &&
    Math.abs(weightTrend.weeklyRateLbs) < 0.3 &&
    userProfile?.goalType === 'cut' &&
    weightTrend.timeSpanDays >= 14;

  // Activity / recovery scores
  const sleepScores = activitySyncs.map((s) => s.sleepScore).filter((v): v is number => v !== null);
  const readinessScores = activitySyncs
    .map((s) => s.readinessScore)
    .filter((v): v is number => v !== null);

  const avgSleepScore = sleepScores.length > 0 ? Math.round(safeAvg(sleepScores)) : null;
  const avgReadinessScore =
    readinessScores.length > 0 ? Math.round(safeAvg(readinessScores)) : null;
  const daysWithPoorSleep = sleepScores.filter((s) => s < 70).length;

  // ----- Assemble payload -----

  const payload: InsightsDataPayload = {
    // User context (from profile, with safe defaults for new users)
    goalType: userProfile?.goalType ?? 'maintain',
    goalRate: userProfile?.goalRate ?? 0,
    dailyKcalTarget: userProfile?.goalKcal ?? 2000,
    proteinTargetG: userProfile?.proteinTargetG ?? 150,
    carbsTargetG: userProfile?.carbsTargetG ?? 200,
    fatTargetG: userProfile?.fatTargetG ?? 65,

    // Tracking stats
    daysTracked: dailyLogs.length,
    avgAdherence,
    avgCalorieDeficit: Math.round(avgCalorieDeficit),
    avgProteinGap: Math.round(avgProteinGap),
    avgCarbsGap: Math.round(avgCarbsGap),
    avgFatGap: Math.round(avgFatGap),
    daysWithLowAdherence,
    streakDays,
    bestDay,
    worstDay,

    // Meal tracking
    totalMeals,
    planMealPct,
    totalSwaps,
    frequentlySwappedSlots,

    // Weight
    isPlateau,
    weightTrendLbsPerWeek,
    weightEntryCount: weightEntries.length,

    // Activity / recovery
    avgSleepScore,
    avgReadinessScore,
    daysWithPoorSleep,
  };

  // ----- Input hash for cache invalidation -----
  const inputHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  const durationMs = Math.round(performance.now() - startMs);
  insightsLogger.aggregationComplete({
    logs: dailyLogs.length,
    meals: totalMeals,
    weights: weightEntries.length,
    swaps: totalSwaps,
    durationMs,
  });

  return { payload, inputHash };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Safe average that returns 0 for empty arrays. */
function safeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Count consecutive days (from the start of the desc-ordered scores array)
 * where the score meets or exceeds the threshold.
 */
function computeStreak(scoresDesc: number[], threshold: number): number {
  let streak = 0;
  for (const score of scoresDesc) {
    if (score >= threshold) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Find the day of the week with the highest and lowest average adherence.
 * Returns null for both if there is no data.
 */
function computeDayOfWeekExtremes(entries: { date: Date; adherence: number }[]): {
  bestDay: string | null;
  worstDay: string | null;
} {
  if (entries.length === 0) return { bestDay: null, worstDay: null };

  // Accumulate totals and counts by day-of-week index
  const totals = new Map<number, { sum: number; count: number }>();

  for (const entry of entries) {
    const dayIdx = entry.date.getUTCDay();
    const existing = totals.get(dayIdx) ?? { sum: 0, count: 0 };
    existing.sum += entry.adherence;
    existing.count++;
    totals.set(dayIdx, existing);
  }

  let bestIdx = -1;
  let bestAvg = -Infinity;
  let worstIdx = -1;
  let worstAvg = Infinity;

  for (const [dayIdx, { sum, count }] of totals) {
    const avg = sum / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestIdx = dayIdx;
    }
    if (avg < worstAvg) {
      worstAvg = avg;
      worstIdx = dayIdx;
    }
  }

  return {
    bestDay: bestIdx >= 0 ? DAY_NAMES[bestIdx] : null,
    worstDay: worstIdx >= 0 ? DAY_NAMES[worstIdx] : null,
  };
}

/**
 * Find meal slots that have been swapped at least `minCount` times.
 */
function computeFrequentSlots(swaps: { slot: string }[], minCount: number): string[] {
  const counts = new Map<string, number>();
  for (const swap of swaps) {
    counts.set(swap.slot, (counts.get(swap.slot) ?? 0) + 1);
  }

  const result: string[] = [];
  for (const [slot, count] of counts) {
    if (count >= minCount) {
      result.push(slot);
    }
  }
  return result;
}
