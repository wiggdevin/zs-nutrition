import {
  ClientIntake,
  MetabolicProfile,
  MetabolicProfileSchema,
  MealTarget,
} from '../types/schemas';

// ============================================================================
// Exported Constants - Canonical values for metabolic calculations
// ============================================================================

/**
 * Activity level multipliers for TDEE calculation (Mifflin-St Jeor)
 */
export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/**
 * Macro split percentages by dietary style
 * protein/carbs/fat as decimal fractions (0.3 = 30%)
 */
export const MACRO_SPLITS: Record<string, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
  low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
  keto: { protein: 0.3, carbs: 0.05, fat: 0.65 },
};

/**
 * Training day calorie bonus by activity level
 */
export const TRAINING_DAY_BONUS: Record<string, number> = {
  sedentary: 150,
  lightly_active: 175,
  moderately_active: 200,
  very_active: 250,
  extremely_active: 300,
};

/**
 * Meal distribution percentages by number of meals
 */
export const MEAL_DISTRIBUTIONS: Record<number, number[]> = {
  2: [0.4, 0.6],
  3: [0.25, 0.35, 0.4],
  4: [0.2, 0.3, 0.35, 0.15],
  5: [0.2, 0.25, 0.3, 0.15, 0.1],
  6: [0.15, 0.25, 0.25, 0.15, 0.1, 0.1],
};

/**
 * Meal slot labels by number of meals
 */
export const MEAL_LABELS: Record<number, string[]> = {
  2: ['breakfast', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'dinner', 'evening_snack'],
  5: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'],
  6: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'],
};

// ============================================================================
// Exported Functions - Canonical calculation utilities
// ============================================================================

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 */
export function calculateBMR(input: {
  sex: string;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  if (input.sex === 'male') {
    return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5;
  }
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
}

/**
 * Calculate Total Daily Energy Expenditure from BMR and activity level
 */
export function calculateTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55));
}

/**
 * Calculate goal calories based on TDEE and goal type
 * IMPORTANT: Bulk uses 350 kcal surplus per lb/week, NOT 500
 */
export function calculateGoalCalories(tdee: number, goalType: string, goalRate: number): number {
  if (goalType === 'cut') return Math.round(tdee - goalRate * 500);
  if (goalType === 'bulk') return Math.round(tdee + goalRate * 350); // NOTE: 350, not 500!
  return tdee;
}

/**
 * Calculate macro targets in grams from calories and macro style
 */
export function calculateMacroTargets(
  goalKcal: number,
  macroStyle: string
): { proteinG: number; carbsG: number; fatG: number } {
  const split = MACRO_SPLITS[macroStyle] || MACRO_SPLITS.balanced;
  return {
    proteinG: Math.round((goalKcal * split.protein) / 4),
    carbsG: Math.round((goalKcal * split.carbs) / 4),
    fatG: Math.round((goalKcal * split.fat) / 9),
  };
}

/**
 * Get training day bonus calories for an activity level
 */
export function getTrainingDayBonus(activityLevel: string): number {
  return TRAINING_DAY_BONUS[activityLevel] ?? 200;
}

// ============================================================================
// MetabolicCalculator Class - Full pipeline agent
// ============================================================================

/**
 * Agent 2: Metabolic Calculator
 * Calculates BMR, TDEE, goal calories, macro targets, and per-meal distribution.
 * Uses Mifflin-St Jeor equation. No LLM required.
 */
export class MetabolicCalculator {
  calculate(intake: ClientIntake): MetabolicProfile {
    // BMR (Mifflin-St Jeor) - use exported function
    const bmr = calculateBMR(intake);
    const bmrKcal = Math.round(bmr);

    // TDEE - use exported function
    const tdeeKcal = calculateTDEE(bmrKcal, intake.activityLevel);

    // Goal Calories - use exported function
    const goalKcal = calculateGoalCalories(tdeeKcal, intake.goalType, intake.goalRate);

    // Training day bonus - use exported function
    const trainingDayBonusKcal = getTrainingDayBonus(intake.activityLevel);
    const restDayKcal = goalKcal;

    // Macro splits - use exported function
    const macros = calculateMacroTargets(goalKcal, intake.macroStyle);
    const proteinTargetG = macros.proteinG;
    const carbsTargetG = macros.carbsG;
    const fatTargetG = macros.fatG;

    // Fiber: 14g per 1000 kcal, minimum 25g
    const fiberTargetG = Math.max(25, Math.round((goalKcal / 1000) * 14));

    // Meal distribution - use exported constants
    const baseDist = MEAL_DISTRIBUTIONS[intake.mealsPerDay] ?? MEAL_DISTRIBUTIONS[3];
    const baseLabels = MEAL_LABELS[intake.mealsPerDay] ?? MEAL_LABELS[3];

    // Get macro split for result
    const split = MACRO_SPLITS[intake.macroStyle] || MACRO_SPLITS.balanced;

    // Adjust for snacks: each snack takes 10%
    const snackTotal = intake.snacksPerDay * 0.1;
    const mealScale = 1 - snackTotal;

    const mealTargets: MealTarget[] = [];

    // Add meal slots
    for (let i = 0; i < baseDist.length; i++) {
      const pct = baseDist[i] * mealScale;
      mealTargets.push({
        slot: `meal_${i + 1}`,
        label: baseLabels[i],
        kcal: Math.round(goalKcal * pct),
        proteinG: Math.round(proteinTargetG * pct),
        carbsG: Math.round(carbsTargetG * pct),
        fatG: Math.round(fatTargetG * pct),
        percentOfDaily: Math.round(pct * 100),
      });
    }

    // Add snack slots
    for (let i = 0; i < intake.snacksPerDay; i++) {
      mealTargets.push({
        slot: `snack_${i + 1}`,
        label: `snack_${i + 1}`,
        kcal: Math.round(goalKcal * 0.1),
        proteinG: Math.round(proteinTargetG * 0.1),
        carbsG: Math.round(carbsTargetG * 0.1),
        fatG: Math.round(fatTargetG * 0.1),
        percentOfDaily: 10,
      });
    }

    const trainingDayKcal = goalKcal + trainingDayBonusKcal;

    const result = {
      bmrKcal,
      tdeeKcal,
      goalKcal,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
      fiberTargetG,
      mealTargets,
      trainingDayBonusKcal,
      restDayKcal,
      trainingDayKcal,
      calculationMethod: 'mifflin_st_jeor' as const,
      macroSplit: {
        proteinPercent: split.protein * 100,
        carbsPercent: split.carbs * 100,
        fatPercent: split.fat * 100,
      },
    };

    return MetabolicProfileSchema.parse(result);
  }
}
