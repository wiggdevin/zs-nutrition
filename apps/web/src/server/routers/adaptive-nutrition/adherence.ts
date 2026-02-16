import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../../trpc';
import { calculateWeightTrend } from '../../utils/weight-trend';
import { logger } from '@/lib/safe-logger';
import { ADAPTIVE_NUTRITION_CONFIG } from './config';

/**
 * Adherence sub-router — weekly checks, activity sync processing, and status.
 */
export const adherenceRouter = router({
  /**
   * runWeeklyCheck: Analyze weight trends and suggest calorie adjustments.
   * Should be called once per week. Returns a suggestion for the user to review.
   */
  runWeeklyCheck: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found. Please complete onboarding first.',
      });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentAdjustment = await prisma.calorieAdjustment.findFirst({
      where: {
        userId: dbUserId,
        createdAt: { gte: oneWeekAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const weightEntriesDesc = await prisma.weightEntry.findMany({
      where: {
        userId: dbUserId,
        logDate: { gte: twoWeeksAgo },
      },
      orderBy: { logDate: 'desc' },
      take: 14,
    });

    const weightEntries = weightEntriesDesc.reverse();

    if (weightEntries.length < 2) {
      return {
        status: 'insufficient_data' as const,
        message: 'Need at least 2 weight entries over the past 2 weeks to analyze trends.',
        entriesFound: weightEntries.length,
        lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
      };
    }

    const trendResult = calculateWeightTrend(weightEntries)!;
    const weeklyRateLbs = trendResult.weeklyRateLbs;

    const goalRateLbs = profile.goalRate;
    const currentGoalKcal = profile.goalKcal ?? 0;
    let adjustmentNeeded = false;
    let suggestedKcal = currentGoalKcal;
    let adjustmentReason = 'Progress is on track - no adjustment needed.';

    if (!profile.bmrKcal) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Metabolic profile is incomplete (missing BMR). Please regenerate your meal plan to recalculate metabolic data.',
      });
    }

    const bmrKcal = profile.bmrKcal;
    const minSafeKcal = bmrKcal + ADAPTIVE_NUTRITION_CONFIG.SAFE_BOUNDS.MIN_ABOVE_BMR;
    const maxSafeKcal = bmrKcal + ADAPTIVE_NUTRITION_CONFIG.SAFE_BOUNDS.MAX_ABOVE_BMR;

    if (profile.goalType === 'cut') {
      const expectedRate = -goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      if (
        trendResult.timeSpanDays >= 14 &&
        weeklyRateLbs > -ADAPTIVE_NUTRITION_CONFIG.PLATEAU_THRESHOLD_LBS_PER_WEEK
      ) {
        const decrease = Math.round(
          Math.abs(deviation) * ADAPTIVE_NUTRITION_CONFIG.ADJUSTMENT_MULTIPLIERS.CUT_DECREASE_PER_LB
        );
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss has stalled (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Consider reducing calories to restart progress.`;
      } else if (deviation > 0.5) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss slower than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Decreasing calories may help.`;
      } else if (deviation < -1) {
        const increase = Math.round(Math.abs(deviation) * 100);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss faster than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Increasing calories can help preserve muscle.`;
      }
    } else if (profile.goalType === 'bulk') {
      const expectedRate = goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      if (deviation < -0.5) {
        const increase = Math.round(Math.abs(deviation) * 150);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        adjustmentNeeded = true;
        adjustmentReason = `Weight gain slower than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Increasing calories will support growth.`;
      } else if (deviation > 1) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight gain faster than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Decreasing calories can help minimize fat gain.`;
      }
    } else if (profile.goalType === 'maintain') {
      if (Math.abs(weeklyRateLbs) > 0.5) {
        if (weeklyRateLbs > 0) {
          const decrease = Math.round(weeklyRateLbs * 100);
          suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
          adjustmentNeeded = true;
          adjustmentReason = `Weight is trending up (${weeklyRateLbs.toFixed(2)} lbs/week). Small calorie decrease recommended to maintain weight.`;
        } else {
          const increase = Math.round(Math.abs(weeklyRateLbs) * 100);
          suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
          adjustmentNeeded = true;
          adjustmentReason = `Weight is trending down (${weeklyRateLbs.toFixed(2)} lbs/week). Small calorie increase recommended to maintain weight.`;
        }
      }
    }

    suggestedKcal =
      Math.round(suggestedKcal / ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR) *
      ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR;

    const firstEntry = weightEntries[0];
    const lastEntry = weightEntries[weightEntries.length - 1];
    const trend = {
      startWeightLbs: firstEntry.weightLbs,
      currentWeightLbs: lastEntry.weightLbs,
      weightChangeLbs: trendResult.weightChangeLbs,
      weeklyRateLbs: trendResult.weeklyRateLbs,
      timeSpanDays: trendResult.timeSpanDays,
      entriesAnalyzed: weightEntries.length,
    };

    if (!adjustmentNeeded) {
      return {
        status: 'no_adjustment_needed' as const,
        message: adjustmentReason,
        trend,
        currentGoalKcal,
        lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
      };
    }

    return {
      status: 'adjustment_suggested' as const,
      suggestion: {
        currentGoalKcal,
        suggestedGoalKcal: suggestedKcal,
        calorieDifference: suggestedKcal - currentGoalKcal,
        reason: adjustmentReason,
        safeBounds: { min: minSafeKcal, max: maxSafeKcal },
      },
      trend,
      lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
    };
  }),

  /**
   * processActivitySync: Process unprocessed activity syncs and adjust daily calorie targets
   */
  processActivitySync: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const unprocessed = await prisma.activitySync.findMany({
      where: {
        userId: dbUserId,
        processed: false,
        syncDate: { gte: startOfToday },
      },
      include: {
        connection: {
          select: {
            platform: true,
            isActive: true,
          },
        },
      },
    });

    if (unprocessed.length === 0) {
      return {
        adjusted: false,
        message: 'No unprocessed activity syncs found for today.',
        syncsProcessed: 0,
        bonusCalories: 0,
      };
    }

    const validSyncs = unprocessed.filter((sync) => sync.connection.isActive);

    if (validSyncs.length === 0) {
      return {
        adjusted: false,
        message: 'All activity syncs are from inactive connections.',
        syncsProcessed: 0,
        bonusCalories: 0,
      };
    }

    const totalActiveCalories = validSyncs.reduce((sum, sync) => {
      return sum + (sync.activeCalories || 0);
    }, 0);

    let bonusCalories = 0;
    let adjusted = false;

    if (totalActiveCalories > ADAPTIVE_NUTRITION_CONFIG.MIN_ACTIVITY_THRESHOLD_KCAL) {
      bonusCalories = Math.round(
        totalActiveCalories * ADAPTIVE_NUTRITION_CONFIG.ACTIVITY_REPLENISHMENT_RATE
      );

      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      });

      if (profile && profile.goalKcal) {
        const baseGoalKcal = profile.goalKcal;
        const baseProteinG = profile.proteinTargetG;
        const baseCarbsG = profile.carbsTargetG;
        const baseFatG = profile.fatTargetG;

        await prisma.$transaction(async (tx) => {
          await tx.dailyLog.upsert({
            where: {
              userId_date: {
                userId: dbUserId,
                date: startOfToday,
              },
            },
            update: {
              targetKcal: { increment: bonusCalories },
            },
            create: {
              userId: dbUserId,
              date: startOfToday,
              targetKcal: baseGoalKcal + bonusCalories,
              targetProteinG: baseProteinG,
              targetCarbsG: baseCarbsG,
              targetFatG: baseFatG,
            },
          });

          await tx.activitySync.updateMany({
            where: {
              id: { in: validSyncs.map((s) => s.id) },
            },
            data: { processed: true },
          });
        });

        adjusted = true;

        logger.info(`[processActivitySync] Adjusted daily target for user ${dbUserId}`, {
          activeCalories: totalActiveCalories,
          bonusCalories,
          syncsProcessed: validSyncs.length,
        });
      } else {
        await prisma.activitySync.updateMany({
          where: {
            id: { in: validSyncs.map((s) => s.id) },
          },
          data: { processed: true },
        });
      }
    } else {
      await prisma.activitySync.updateMany({
        where: {
          id: { in: validSyncs.map((s) => s.id) },
        },
        data: { processed: true },
      });
    }

    return {
      adjusted,
      message: adjusted
        ? `Added ${bonusCalories} bonus calories based on ${Math.round(totalActiveCalories)} active calories burned.`
        : totalActiveCalories > 0
          ? `Activity logged (${Math.round(totalActiveCalories)} kcal) but below ${ADAPTIVE_NUTRITION_CONFIG.MIN_ACTIVITY_THRESHOLD_KCAL} kcal threshold for bonus.`
          : 'Activity syncs processed but no active calories recorded.',
      syncsProcessed: validSyncs.length,
      totalActiveCalories: Math.round(totalActiveCalories),
      bonusCalories,
      platforms: [...new Set(validSyncs.map((s) => s.connection.platform))],
    };
  }),

  /**
   * getActivitySyncStatus: Get summary of activity sync status for the dashboard
   */
  getActivitySyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const [todaysSyncs, todaysLog, profile] = await Promise.all([
      prisma.activitySync.findMany({
        where: {
          userId: dbUserId,
          syncDate: { gte: startOfToday },
        },
        include: {
          connection: {
            select: {
              platform: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.dailyLog.findUnique({
        where: {
          userId_date: {
            userId: dbUserId,
            date: startOfToday,
          },
        },
      }),
      prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      }),
    ]);

    const totalActiveCalories = todaysSyncs.reduce((sum, sync) => {
      return sum + (sync.activeCalories || 0);
    }, 0);

    const processedCount = todaysSyncs.filter((s) => s.processed).length;
    const unprocessedCount = todaysSyncs.filter((s) => !s.processed).length;

    return {
      todaysSyncs: {
        total: todaysSyncs.length,
        processed: processedCount,
        unprocessed: unprocessedCount,
      },
      totalActiveCalories: Math.round(totalActiveCalories),
      bonusApplied:
        todaysLog?.targetKcal && profile?.goalKcal
          ? Math.max(0, todaysLog.targetKcal - profile.goalKcal)
          : 0,
      platforms: [...new Set(todaysSyncs.map((s) => s.connection.platform))],
      hasUnprocessed: unprocessedCount > 0,
    };
  }),
});
