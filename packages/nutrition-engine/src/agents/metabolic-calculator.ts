import {
  ClientIntake,
  MetabolicProfile,
  MetabolicProfileSchema,
  MealTarget,
} from '../types/schemas';
import type { BiometricContext } from '../types/biometric-context';

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

/**
 * Safety-critical caloric floors (kcal/day) to prevent dangerously low intake.
 * Based on established clinical nutrition guidelines.
 */
export const CALORIC_FLOOR_FEMALE = 1200;
export const CALORIC_FLOOR_MALE = 1500;

/**
 * Maximum fraction of daily calories that can be allocated to snacks.
 * Prevents excessive snack allocation (e.g., 4 snacks x 10% = 40%).
 */
export const SNACK_ALLOCATION_CAP = 0.25;

/**
 * Goal-based protein targets in grams per kilogram of bodyweight.
 * Evidence-based values for body recomposition optimization:
 * - Cut: higher protein preserves lean mass during caloric deficit
 * - Maintain: moderate protein for tissue maintenance
 * - Bulk: slightly lower g/kg since surplus supports anabolism
 */
export const PROTEIN_G_PER_KG: Record<string, number> = {
  cut: 2.0,
  maintain: 1.8,
  bulk: 1.7,
};

/**
 * Sex-specific daily fiber floor (grams/day).
 * Based on USDA Dietary Guidelines for Americans adequate intake levels.
 */
export const FIBER_FLOOR_FEMALE = 25;
export const FIBER_FLOOR_MALE = 38;

// ============================================================================
// Exported Functions - Canonical calculation utilities
// ============================================================================

/**
 * Calculate Basal Metabolic Rate using dual-path approach:
 * - Katch-McArdle when bodyFatPercent is available (more accurate with body composition data)
 * - Mifflin-St Jeor as fallback (population-based estimate)
 */
export function calculateBMR(input: {
  sex: string;
  weightKg: number;
  heightCm: number;
  age: number;
  bodyFatPercent?: number;
}): { bmr: number; method: 'katch_mcardle' | 'mifflin_st_jeor' } {
  // Katch-McArdle path: requires valid body fat percentage (3-60% clinical range)
  if (
    input.bodyFatPercent !== null &&
    input.bodyFatPercent !== undefined &&
    input.bodyFatPercent >= 3 &&
    input.bodyFatPercent <= 60
  ) {
    const leanMass = input.weightKg * (1 - input.bodyFatPercent / 100);
    return { bmr: 370 + 21.6 * leanMass, method: 'katch_mcardle' };
  }
  // Mifflin-St Jeor fallback
  const bmr =
    input.sex === 'male'
      ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
      : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
  return { bmr, method: 'mifflin_st_jeor' };
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
 * Calculate protein target in grams based on bodyweight and goal type.
 * Uses evidence-based g/kg multipliers with a clinical safety cap of 2.5 g/kg
 * to prevent excessive protein intake that could stress renal function.
 */
export function calculateProteinG(weightKg: number, goalType: string): number {
  const gPerKg = PROTEIN_G_PER_KG[goalType] ?? 1.8;
  const rawProtein = Math.round(weightKg * gPerKg);
  // Clinical safety cap: 2.5 g/kg
  return Math.min(rawProtein, Math.round(weightKg * 2.5));
}

/**
 * Calculate training day bonus calories based on TDEE and training duration.
 * Formula: TDEE * 0.05 * (trainingTimeMinutes / 60), clamped to 150-400 kcal.
 * This replaces the static lookup table with a formula that scales with
 * the individual's energy expenditure and actual training volume.
 */
export function getTrainingDayBonus(tdee: number, trainingTimeMinutes: number = 60): number {
  const rawBonus = Math.round(tdee * 0.05 * (trainingTimeMinutes / 60));
  return Math.max(150, Math.min(400, rawBonus));
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
  calculate(intake: ClientIntake, biometricContext?: BiometricContext): MetabolicProfile {
    // BMR - dual-path: Katch-McArdle (with body fat) or Mifflin-St Jeor (fallback)
    const { bmr, method: bmrMethod } = calculateBMR({
      ...intake,
      bodyFatPercent: intake.bodyFatPercent,
    });
    const bmrKcal = Math.round(bmr);

    // TDEE - use exported function
    const tdeeKcal = calculateTDEE(bmrKcal, intake.activityLevel);

    // Goal Calories - use exported function
    const goalKcalRaw = calculateGoalCalories(tdeeKcal, intake.goalType, intake.goalRate);

    // Safety: enforce sex-specific caloric floor to prevent dangerously low intake
    const caloricFloor = intake.sex === 'male' ? CALORIC_FLOOR_MALE : CALORIC_FLOOR_FEMALE;
    const goalKcalFloorApplied = goalKcalRaw < caloricFloor;
    const goalKcal = Math.max(goalKcalRaw, caloricFloor);

    // Training day bonus - formula-based on TDEE and training duration
    // Map training time enum to minutes (conservative defaults)
    const trainingTimeMinutes =
      intake.trainingTime === 'morning'
        ? 60
        : intake.trainingTime === 'afternoon'
          ? 75
          : intake.trainingTime === 'evening'
            ? 60
            : 60; // default 60 min
    let trainingDayBonusKcal = getTrainingDayBonus(tdeeKcal, trainingTimeMinutes);
    let baseCalorieAdjustment = 0;
    let proteinAdjustmentG = 0;
    let biometricTrainingBonusModifier = 1.0;
    let biometricReason = '';

    // Biometric adjustments: modify training bonus and base calories based on recovery state
    if (
      biometricContext &&
      biometricContext.dataAvailable &&
      biometricContext.historicalDays >= 7
    ) {
      const recovery = biometricContext.recoveryState;
      if (recovery === 'compromised') {
        biometricTrainingBonusModifier = 0.5;
        trainingDayBonusKcal = Math.round(trainingDayBonusKcal * 0.5);
        biometricReason = 'Compromised recovery: training bonus reduced by 50%';
      } else if (recovery === 'depleted') {
        biometricTrainingBonusModifier = 0;
        trainingDayBonusKcal = 0;
        // +3% base calories for recovery, capped at +75 kcal
        baseCalorieAdjustment = Math.min(75, Math.round(goalKcal * 0.03));
        biometricReason =
          'Depleted recovery: training bonus cancelled, +' +
          baseCalorieAdjustment +
          ' kcal for recovery';
      }
    }

    const adjustedGoalKcal = goalKcal + baseCalorieAdjustment;
    const restDayKcal = adjustedGoalKcal;

    // NEW: g/kg protein calculation (replaces percentage-based protein)
    let proteinTargetG = calculateProteinG(intake.weightKg, intake.goalType);
    // Macro redistribution on low recovery: +10% protein (cap 2.5g/kg), shift 5% carb→fat
    if (
      biometricContext &&
      biometricContext.dataAvailable &&
      biometricContext.historicalDays >= 7 &&
      (biometricContext.recoveryState === 'compromised' ||
        biometricContext.recoveryState === 'depleted')
    ) {
      const boostedProtein = Math.round(proteinTargetG * 1.1);
      const proteinCap = Math.round(intake.weightKg * 2.5);
      proteinAdjustmentG = Math.min(boostedProtein, proteinCap) - proteinTargetG;
      proteinTargetG = Math.min(boostedProtein, proteinCap);
    }

    const proteinKcal = proteinTargetG * 4;
    // Remaining calories split between carbs and fat using macroStyle ratios
    const remainingKcal = Math.max(0, adjustedGoalKcal - proteinKcal);
    const split = MACRO_SPLITS[intake.macroStyle] || MACRO_SPLITS.balanced;
    // Normalize carb/fat ratio from the split (excluding protein)
    const carbFatTotal = split.carbs + split.fat;
    const carbsTargetG = Math.round((remainingKcal * (split.carbs / carbFatTotal)) / 4);
    const fatTargetG = Math.round((remainingKcal * (split.fat / carbFatTotal)) / 9);

    // Fiber: 14g per 1000 kcal with sex-specific floor (male: 38g, female: 25g)
    const fiberFloor = intake.sex === 'male' ? FIBER_FLOOR_MALE : FIBER_FLOOR_FEMALE;
    const fiberTargetG = Math.max(fiberFloor, Math.round((adjustedGoalKcal / 1000) * 14));

    // Meal distribution - use exported constants
    const baseDist = MEAL_DISTRIBUTIONS[intake.mealsPerDay] ?? MEAL_DISTRIBUTIONS[3];
    const baseLabels = MEAL_LABELS[intake.mealsPerDay] ?? MEAL_LABELS[3];

    // Adjust for snacks: each snack takes 10%, capped at 25% total
    const snackTotal = Math.min(intake.snacksPerDay * 0.1, SNACK_ALLOCATION_CAP);
    const snackPctEach = intake.snacksPerDay > 0 ? snackTotal / intake.snacksPerDay : 0;
    const mealScale = 1 - snackTotal;

    const mealTargets: MealTarget[] = [];

    // Add meal slots
    for (let i = 0; i < baseDist.length; i++) {
      const pct = baseDist[i] * mealScale;
      mealTargets.push({
        slot: `meal_${i + 1}`,
        label: baseLabels[i],
        kcal: Math.round(adjustedGoalKcal * pct),
        proteinG: Math.round(proteinTargetG * pct),
        carbsG: Math.round(carbsTargetG * pct),
        fatG: Math.round(fatTargetG * pct),
        percentOfDaily: Math.round(pct * 100),
      });
    }

    // Add snack slots (using capped per-snack percentage)
    for (let i = 0; i < intake.snacksPerDay; i++) {
      mealTargets.push({
        slot: `snack_${i + 1}`,
        label: `snack_${i + 1}`,
        kcal: Math.round(adjustedGoalKcal * snackPctEach),
        proteinG: Math.round(proteinTargetG * snackPctEach),
        carbsG: Math.round(carbsTargetG * snackPctEach),
        fatG: Math.round(fatTargetG * snackPctEach),
        percentOfDaily: Math.round(snackPctEach * 100),
      });
    }

    const trainingDayKcal = adjustedGoalKcal + trainingDayBonusKcal;

    // Training-day-specific macro targets: extra bonus calories go to carbs
    const trainingDayMacros = {
      proteinG: proteinTargetG, // protein stays same
      carbsG: Math.round(carbsTargetG + trainingDayBonusKcal / 4), // extra carbs
      fatG: fatTargetG, // fat stays same
    };

    // Compute actual macro percentages from resolved gram values
    const totalMacroKcal = proteinTargetG * 4 + carbsTargetG * 4 + fatTargetG * 9;
    const actualProteinPct =
      totalMacroKcal > 0 ? Math.round(((proteinTargetG * 4) / totalMacroKcal) * 100) : 0;
    const actualCarbsPct =
      totalMacroKcal > 0 ? Math.round(((carbsTargetG * 4) / totalMacroKcal) * 100) : 0;
    const actualFatPct =
      totalMacroKcal > 0 ? Math.round(((fatTargetG * 9) / totalMacroKcal) * 100) : 0;

    const biometricAdjustment =
      biometricContext && biometricContext.dataAvailable && biometricContext.historicalDays >= 7
        ? {
            applied: biometricTrainingBonusModifier !== 1.0 || baseCalorieAdjustment !== 0,
            recoveryState: biometricContext.recoveryState,
            trainingBonusModifier: biometricTrainingBonusModifier,
            baseCalorieAdjustment,
            proteinAdjustmentG,
            reason: biometricReason || 'No adjustment needed',
          }
        : undefined;

    const result = {
      bmrKcal,
      tdeeKcal,
      goalKcal: adjustedGoalKcal,
      goalKcalFloorApplied,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
      fiberTargetG,
      mealTargets,
      trainingDayBonusKcal,
      restDayKcal,
      trainingDayKcal,
      trainingDayMacros,
      calculationMethod: bmrMethod,
      proteinMethod: 'g_per_kg' as const,
      macroSplit: {
        proteinPercent: actualProteinPct,
        carbsPercent: actualCarbsPct,
        fatPercent: actualFatPct,
      },
      biometricAdjustment,
    };

    return MetabolicProfileSchema.parse(result);
  }
}
