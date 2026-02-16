/**
 * Shared weight trend calculation utility.
 * Used by both analyzeWeightTrend and suggestCalorieAdjustment procedures.
 */

export interface WeightEntry {
  weightKg: number;
  weightLbs: number;
  logDate: Date;
}

export interface WeightTrendResult {
  weightChangeKg: number;
  weightChangeLbs: number;
  weeklyRateKg: number;
  weeklyRateLbs: number;
  timeSpanDays: number;
}

/**
 * Calculate weight trend from a chronologically ordered array of weight entries.
 * Entries must be sorted ascending by logDate.
 */
export function calculateWeightTrend(entries: WeightEntry[]): WeightTrendResult | null {
  if (entries.length < 2) return null;

  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];
  const timeSpanDays = Math.max(
    1,
    Math.round((lastEntry.logDate.getTime() - firstEntry.logDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const weightChangeKg = lastEntry.weightKg - firstEntry.weightKg;
  const weightChangeLbs = lastEntry.weightLbs - firstEntry.weightLbs;
  const weeklyRateKg = (weightChangeKg / timeSpanDays) * 7;
  const weeklyRateLbs = (weightChangeLbs / timeSpanDays) * 7;

  return {
    weightChangeKg: Math.round(weightChangeKg * 10) / 10,
    weightChangeLbs: Math.round(weightChangeLbs * 10) / 10,
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    weeklyRateLbs: Math.round(weeklyRateLbs * 100) / 100,
    timeSpanDays,
  };
}

/**
 * Fetch weight entries in chronological order for trend analysis.
 * Fetches in descending order and reverses for correct calculation order.
 */
export async function fetchChronologicalWeightEntries(
  prisma: { weightEntry: { findMany: (args: Record<string, unknown>) => Promise<WeightEntry[]> } },
  userId: string,
  options?: { take?: number; dateFilter?: Date }
): Promise<WeightEntry[]> {
  const where: Record<string, unknown> = { userId };
  if (options?.dateFilter) {
    where.logDate = { gte: options.dateFilter };
  }

  const entries = await prisma.weightEntry.findMany({
    where,
    orderBy: { logDate: 'desc' },
    take: options?.take ?? 90,
  });

  return (entries as WeightEntry[]).reverse();
}
