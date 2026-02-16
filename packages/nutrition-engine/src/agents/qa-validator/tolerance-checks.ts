import type { CompiledDay, CompiledMeal } from '../../types/schemas';

export const KCAL_TOLERANCE = 0.03; // +/- 3%
export const MACRO_TOLERANCE = 0.05; // +/- 5%
export const MAX_ITERATIONS = 3;

/**
 * Find days that violate kcal or macro tolerances.
 */
export function findViolations(
  days: CompiledDay[]
): Array<{ dayIndex: number; type: 'kcal' | 'macro'; variancePercent: number }> {
  const violations: Array<{
    dayIndex: number;
    type: 'kcal' | 'macro';
    variancePercent: number;
  }> = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const absKcalVariance = Math.abs(day.variancePercent) / 100;

    if (absKcalVariance > KCAL_TOLERANCE) {
      violations.push({
        dayIndex: i,
        type: 'kcal',
        variancePercent: day.variancePercent,
      });
      continue; // Don't double-count
    }

    // Check macro tolerances (protein, carbs, fat)
    if (day.targetKcal > 0) {
      const totalMacroKcal =
        day.dailyTotals.proteinG * 4 + day.dailyTotals.carbsG * 4 + day.dailyTotals.fatG * 9;

      if (totalMacroKcal > 0) {
        const macroVsKcal = Math.abs(totalMacroKcal - day.dailyTotals.kcal) / day.dailyTotals.kcal;
        if (macroVsKcal > MACRO_TOLERANCE) {
          violations.push({
            dayIndex: i,
            type: 'macro',
            variancePercent: macroVsKcal * 100,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Calculate QA score 0-100.
 * Score is based on how close each day is to its target kcal.
 * Perfect adherence = 100, each % of variance costs points.
 */
export function calculateQAScore(days: CompiledDay[]): number {
  if (days.length === 0) {
    return 100;
  }

  let totalScore = 0;

  for (const day of days) {
    const absVariance = Math.abs(day.variancePercent);
    // Each day starts at 100 and loses points for variance
    // 1% variance = -5 points, capped at 0
    const dayScore = Math.max(0, 100 - absVariance * 5);
    totalScore += dayScore;
  }

  return Math.round(totalScore / days.length);
}

/**
 * Calculate weekly average totals across all days.
 */
export function calculateWeeklyTotals(days: CompiledDay[]) {
  if (days.length === 0) {
    return { avgKcal: 0, avgProteinG: 0, avgCarbsG: 0, avgFatG: 0 };
  }

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const day of days) {
    totalKcal += day.dailyTotals.kcal;
    totalProtein += day.dailyTotals.proteinG;
    totalCarbs += day.dailyTotals.carbsG;
    totalFat += day.dailyTotals.fatG;
  }

  const count = days.length;
  return {
    avgKcal: Math.round(totalKcal / count),
    avgProteinG: Math.round((totalProtein / count) * 10) / 10,
    avgCarbsG: Math.round((totalCarbs / count) * 10) / 10,
    avgFatG: Math.round((totalFat / count) * 10) / 10,
  };
}

/**
 * Recalculate daily nutrition totals from meals.
 */
export function recalcDailyTotals(meals: CompiledMeal[]) {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG = 0;

  for (const meal of meals) {
    kcal += meal.nutrition.kcal;
    proteinG += meal.nutrition.proteinG;
    carbsG += meal.nutrition.carbsG;
    fatG += meal.nutrition.fatG;
    if (meal.nutrition.fiberG) {
      fiberG += meal.nutrition.fiberG;
    }
  }

  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
    fiberG: fiberG > 0 ? Math.round(fiberG * 10) / 10 : undefined,
  };
}
