/**
 * Metabolic Calculation Utilities
 *
 * This module re-exports canonical metabolic calculation constants and functions
 * from the nutrition-engine package. All metabolic calculations in the web app
 * should use these utilities to ensure consistency.
 *
 * IMPORTANT: These are the CANONICAL values. Do not duplicate or override:
 * - Bulk surplus: 350 kcal/lb/week (NOT 500)
 * - Cut deficit: 500 kcal/lb/week
 * - Macro splits: Use full key names (protein/carbs/fat)
 */

import {
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  getTrainingDayBonus,
} from '@zero-sum/nutrition-engine';

// Re-export all constants and functions
export {
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  getTrainingDayBonus,
};

/**
 * Input type for metabolic profile calculation
 */
export interface MetabolicProfileInput {
  sex: string;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: string;
  goalType: string;
  goalRate: number;
  macroStyle: string;
}

/**
 * Output type for metabolic profile calculation
 */
export interface MetabolicProfileResult {
  bmrKcal: number;
  tdeeKcal: number;
  goalKcal: number;
  trainingDayKcal: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

/**
 * Calculate complete metabolic profile from user input.
 * This is a convenience function that combines all the individual calculations.
 *
 * @param input - User profile data
 * @returns Complete metabolic profile with BMR, TDEE, goal calories, and macro targets
 */
export function calculateMetabolicProfile(input: MetabolicProfileInput): MetabolicProfileResult {
  const bmr = calculateBMR(input);
  const bmrKcal = Math.round(bmr);
  const tdeeKcal = calculateTDEE(bmrKcal, input.activityLevel);
  const goalKcal = calculateGoalCalories(tdeeKcal, input.goalType, input.goalRate);
  const macros = calculateMacroTargets(goalKcal, input.macroStyle);
  const trainingBonus = getTrainingDayBonus(input.activityLevel);

  return {
    bmrKcal,
    tdeeKcal,
    goalKcal,
    trainingDayKcal: goalKcal + trainingBonus,
    proteinTargetG: macros.proteinG,
    carbsTargetG: macros.carbsG,
    fatTargetG: macros.fatG,
  };
}

/**
 * Recalculate macros for a new calorie target.
 * Useful for adaptive nutrition adjustments.
 *
 * @param goalKcal - New calorie target
 * @param macroStyle - Macro split style (balanced, high_protein, low_carb, keto)
 * @returns Macro targets in grams
 */
export function recalculateMacrosForCalories(
  goalKcal: number,
  macroStyle: string
): { proteinG: number; carbsG: number; fatG: number } {
  return calculateMacroTargets(goalKcal, macroStyle);
}
