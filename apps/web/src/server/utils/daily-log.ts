import { PrismaClient } from '@prisma/client';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Calculate adherence score (0-100) based on how close actuals are to targets.
 */
export function calculateAdherenceScore(dailyLog: {
  actualKcal: number;
  actualProteinG: number;
  actualCarbsG: number;
  actualFatG: number;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
}): number {
  const targets = {
    kcal: dailyLog.targetKcal || 2000,
    protein: dailyLog.targetProteinG || 150,
    carbs: dailyLog.targetCarbsG || 200,
    fat: dailyLog.targetFatG || 65,
  };

  // Score each macro: 100 if exact, decreasing as you deviate
  // Being under target is slightly better than being over
  function macroScore(actual: number, target: number): number {
    if (target === 0) return 100;
    const ratio = actual / target;
    if (ratio <= 1) {
      // Under target: score from 0-100 based on how close
      return Math.round(ratio * 100);
    } else {
      // Over target: penalize going over
      const overBy = ratio - 1;
      return Math.max(0, Math.round(100 - overBy * 200));
    }
  }

  const kcalScore = macroScore(dailyLog.actualKcal, targets.kcal);
  const proteinScore = macroScore(dailyLog.actualProteinG, targets.protein);
  const carbsScore = macroScore(dailyLog.actualCarbsG, targets.carbs);
  const fatScore = macroScore(dailyLog.actualFatG, targets.fat);

  // Weighted average: calories and protein matter more
  const score = Math.round(
    kcalScore * 0.35 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.15
  );
  return Math.min(100, Math.max(0, score));
}

/**
 * Recalculate a DailyLog's actual totals from all TrackedMeals for that day.
 * Uses Prisma aggregate to compute sums database-side instead of fetching all meals.
 *
 * Works with both the regular PrismaClient and the transaction client from $transaction().
 */
export async function recalculateDailyLog(
  tx: PrismaClient | PrismaTransactionClient,
  userId: string,
  date: Date
) {
  const totals = await tx.trackedMeal.aggregate({
    where: { userId, loggedDate: date },
    _sum: {
      kcal: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
    },
    _count: true,
  });

  return {
    actualKcal: Math.round(totals._sum.kcal ?? 0),
    actualProteinG: Math.round(totals._sum.proteinG ?? 0),
    actualCarbsG: Math.round(totals._sum.carbsG ?? 0),
    actualFatG: Math.round(totals._sum.fatG ?? 0),
    mealCount: totals._count,
  };
}
