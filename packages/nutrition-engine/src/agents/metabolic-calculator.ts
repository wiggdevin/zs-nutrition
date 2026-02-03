import { ClientIntake, MetabolicProfile, MetabolicProfileSchema, MealTarget } from '../types/schemas';

/**
 * Agent 2: Metabolic Calculator
 * Calculates BMR, TDEE, goal calories, macro targets, and per-meal distribution.
 * Uses Mifflin-St Jeor equation. No LLM required.
 */
export class MetabolicCalculator {
  private static readonly ACTIVITY_MULTIPLIERS: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };

  private static readonly MACRO_SPLITS: Record<string, { protein: number; carbs: number; fat: number }> = {
    balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
    high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
    low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
    keto: { protein: 0.3, carbs: 0.05, fat: 0.65 },
  };

  private static readonly MEAL_DISTRIBUTIONS: Record<number, number[]> = {
    2: [0.40, 0.60],
    3: [0.25, 0.35, 0.40],
    4: [0.20, 0.30, 0.35, 0.15],
    5: [0.20, 0.25, 0.30, 0.15, 0.10],
    6: [0.15, 0.25, 0.25, 0.15, 0.10, 0.10],
  };

  private static readonly MEAL_LABELS: Record<number, string[]> = {
    2: ['breakfast', 'dinner'],
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'dinner', 'evening_snack'],
    5: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'],
    6: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'],
  };

  calculate(intake: ClientIntake): MetabolicProfile {
    // BMR (Mifflin-St Jeor)
    let bmr: number;
    if (intake.sex === 'male') {
      bmr = 10 * intake.weightKg + 6.25 * intake.heightCm - 5 * intake.age + 5;
    } else {
      bmr = 10 * intake.weightKg + 6.25 * intake.heightCm - 5 * intake.age - 161;
    }
    const bmrKcal = Math.round(bmr);

    // TDEE
    const multiplier = MetabolicCalculator.ACTIVITY_MULTIPLIERS[intake.activityLevel];
    const tdeeKcal = Math.round(bmrKcal * multiplier);

    // Goal Calories
    let goalKcal: number;
    if (intake.goalType === 'cut') {
      goalKcal = Math.round(tdeeKcal - intake.goalRate * 500);
    } else if (intake.goalType === 'bulk') {
      goalKcal = Math.round(tdeeKcal + intake.goalRate * 350);
    } else {
      goalKcal = tdeeKcal;
    }

    // Training day bonus (150-300 based on activity)
    const bonusMap: Record<string, number> = {
      sedentary: 150,
      lightly_active: 175,
      moderately_active: 200,
      very_active: 250,
      extremely_active: 300,
    };
    const trainingDayBonusKcal = bonusMap[intake.activityLevel] ?? 200;
    const restDayKcal = goalKcal;

    // Macro splits
    const split = MetabolicCalculator.MACRO_SPLITS[intake.macroStyle];
    const proteinTargetG = Math.round((goalKcal * split.protein) / 4);
    const carbsTargetG = Math.round((goalKcal * split.carbs) / 4);
    const fatTargetG = Math.round((goalKcal * split.fat) / 9);

    // Fiber: 14g per 1000 kcal, minimum 25g
    const fiberTargetG = Math.max(25, Math.round((goalKcal / 1000) * 14));

    // Meal distribution
    const baseDist = MetabolicCalculator.MEAL_DISTRIBUTIONS[intake.mealsPerDay] ?? MetabolicCalculator.MEAL_DISTRIBUTIONS[3];
    const baseLabels = MetabolicCalculator.MEAL_LABELS[intake.mealsPerDay] ?? MetabolicCalculator.MEAL_LABELS[3];

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
