import type { CompiledDay, CompiledMeal } from '../../types/schemas';

export const KCAL_TOLERANCE = 0.03; // +/- 3%

/** @deprecated Use PROTEIN_TOLERANCE, CARBS_TOLERANCE, FAT_TOLERANCE instead. Kept for backward compatibility. */
export const MACRO_TOLERANCE = 0.05; // +/- 5% (legacy)

// Per-macro differentiated tolerances (P2-T06)
export const PROTEIN_TOLERANCE = 0.1; // +/- 10%
export const CARBS_TOLERANCE = 0.15; // +/- 15%
export const FAT_TOLERANCE = 0.15; // +/- 15%
export const KCAL_ABS_FLOOR = 50; // 50 kcal absolute minimum variance threshold

export const MAX_ITERATIONS = 3; // Legacy: kept for backward compat but single-pass is now used

/**
 * Compute a tolerance multiplier based on average meal confidence for a day.
 * High-confidence days (database-backed data) get tighter tolerances.
 * Low-confidence days (AI estimates) get looser tolerances.
 *
 * >= 0.8 avg confidence → 1.0x (default, tightest)
 * 0.5 - 0.8            → 1.5x
 * < 0.5                → 2.0x (loosest)
 */
export function confidenceToleranceMultiplier(day: CompiledDay): number {
  const meals = day.meals;
  if (meals.length === 0) return 1.0;

  let totalScore = 0;
  let scoredMeals = 0;
  for (const meal of meals) {
    if (meal.confidenceScore !== undefined && meal.confidenceScore !== null) {
      totalScore += meal.confidenceScore;
      scoredMeals++;
    }
  }

  // If no meals have confidence scores, use default tolerances
  if (scoredMeals === 0) return 1.0;

  const avg = totalScore / scoredMeals;
  if (avg >= 0.8) return 1.0;
  if (avg >= 0.5) return 1.5;
  return 2.0;
}

export interface Violation {
  dayIndex: number;
  type: 'kcal' | 'macro';
  variancePercent: number;
  /** Which specific macros are out of tolerance (only for macro violations) */
  offendingMacros?: Array<'protein' | 'carbs' | 'fat'>;
}

/**
 * Find days that violate kcal or per-macro tolerances.
 *
 * Kcal check uses max(KCAL_TOLERANCE, KCAL_ABS_FLOOR / targetKcal) as the
 * effective tolerance so very low-calorie targets don't trigger on tiny
 * absolute deviations.
 *
 * When `macroTargets` is present on a CompiledDay, each macro (proteinG,
 * carbsG, fatG) is validated individually against its own tolerance:
 * - Protein: +/- 10%
 * - Carbs:   +/- 15%
 * - Fat:     +/- 15%
 */
export function findViolations(days: CompiledDay[]): Violation[] {
  const violations: Violation[] = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const absKcalVariance = Math.abs(day.variancePercent) / 100;

    // Confidence-aware tolerance multiplier: looser for low-confidence days
    const confMultiplier = confidenceToleranceMultiplier(day);

    // Effective kcal tolerance: max of percentage-based and absolute-floor-based
    const effectiveKcalTolerance =
      day.targetKcal > 0
        ? Math.max(KCAL_TOLERANCE * confMultiplier, KCAL_ABS_FLOOR / day.targetKcal)
        : KCAL_TOLERANCE * confMultiplier;

    if (absKcalVariance > effectiveKcalTolerance) {
      violations.push({
        dayIndex: i,
        type: 'kcal',
        variancePercent: day.variancePercent,
      });
      continue; // Don't double-count kcal + macro on same day
    }

    // Per-macro validation against day-level macro targets
    if (day.macroTargets) {
      const { proteinG: tP, carbsG: tC, fatG: tF } = day.macroTargets;
      const { proteinG: aP, carbsG: aC, fatG: aF } = day.dailyTotals;

      const proteinVar = tP > 0 ? Math.abs(aP - tP) / tP : 0;
      const carbsVar = tC > 0 ? Math.abs(aC - tC) / tC : 0;
      const fatVar = tF > 0 ? Math.abs(aF - tF) / tF : 0;

      // Check each macro against its individual tolerance (scaled by confidence)
      const offendingMacros: Array<'protein' | 'carbs' | 'fat'> = [];
      if (proteinVar > PROTEIN_TOLERANCE * confMultiplier) offendingMacros.push('protein');
      if (carbsVar > CARBS_TOLERANCE * confMultiplier) offendingMacros.push('carbs');
      if (fatVar > FAT_TOLERANCE * confMultiplier) offendingMacros.push('fat');

      if (offendingMacros.length > 0) {
        const worstVar = Math.max(proteinVar, carbsVar, fatVar);
        violations.push({
          dayIndex: i,
          type: 'macro',
          variancePercent: Math.round(worstVar * 10000) / 100,
          offendingMacros,
        });
      }
    } else {
      // Legacy fallback: arithmetic consistency check (no macro targets available)
      if (day.targetKcal > 0) {
        const totalMacroKcal =
          day.dailyTotals.proteinG * 4 + day.dailyTotals.carbsG * 4 + day.dailyTotals.fatG * 9;

        if (totalMacroKcal > 0) {
          const macroVsKcal =
            Math.abs(totalMacroKcal - day.dailyTotals.kcal) / day.dailyTotals.kcal;
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
  }

  return violations;
}

/**
 * Compute per-macro variance percentages for a compiled day.
 * Returns the signed variance percentage for each macro relative to its target.
 * Returns null if the day has no macroTargets.
 */
export function computeMacroVariances(
  day: CompiledDay
): { proteinPercent: number; carbsPercent: number; fatPercent: number } | null {
  if (!day.macroTargets) {
    return null;
  }

  const { proteinG: tP, carbsG: tC, fatG: tF } = day.macroTargets;
  const { proteinG: aP, carbsG: aC, fatG: aF } = day.dailyTotals;

  return {
    proteinPercent: tP > 0 ? Math.round(((aP - tP) / tP) * 10000) / 100 : 0,
    carbsPercent: tC > 0 ? Math.round(((aC - tC) / tC) * 10000) / 100 : 0,
    fatPercent: tF > 0 ? Math.round(((aF - tF) / tF) * 10000) / 100 : 0,
  };
}

/**
 * Calculate QA score 0-100.
 * Score is based on how close each day is to its target kcal.
 * Perfect adherence = 100, each % of variance costs points.
 */
export function calculateQAScore(
  days: CompiledDay[],
  complianceViolationCount: number = 0
): number {
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

  let score = Math.round(totalScore / days.length);
  score = Math.max(0, score - complianceViolationCount * 15);
  return score;
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
