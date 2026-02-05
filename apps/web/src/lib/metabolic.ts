// Metabolic Calculator - Agent 2 logic
// Mifflin-St Jeor equation for BMR, TDEE, goal calories, macro splits

export interface MetabolicProfile {
  bmrKcal: number;
  tdeeKcal: number;
  goalKcal: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  trainingBonusKcal: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

const MACRO_SPLITS: Record<string, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
  low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
  keto: { protein: 0.3, carbs: 0.05, fat: 0.65 },
};

export function calculateMetabolicProfile(params: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goalType: string;
  goalRate: number;
  macroStyle: string;
}): MetabolicProfile {
  const { sex, age, heightCm, weightKg, activityLevel, goalType, goalRate, macroStyle } = params;

  // Mifflin-St Jeor BMR
  let bmrKcal: number;
  if (sex === 'male') {
    bmrKcal = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  } else {
    bmrKcal = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }

  // TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  const tdeeKcal = Math.round(bmrKcal * multiplier);

  // Goal calories
  let goalKcal: number;
  if (goalType === 'cut') {
    goalKcal = Math.round(tdeeKcal - goalRate * 500);
  } else if (goalType === 'bulk') {
    goalKcal = Math.round(tdeeKcal + goalRate * 350);
  } else {
    goalKcal = tdeeKcal;
  }

  // Training day bonus based on activity
  let trainingBonusKcal = 200;
  if (activityLevel === 'very_active' || activityLevel === 'extremely_active') {
    trainingBonusKcal = 300;
  } else if (activityLevel === 'sedentary' || activityLevel === 'lightly_active') {
    trainingBonusKcal = 150;
  }

  // Macro splits
  const split = MACRO_SPLITS[macroStyle] || MACRO_SPLITS.balanced;
  const proteinTargetG = Math.round((goalKcal * split.protein) / 4);
  const carbsTargetG = Math.round((goalKcal * split.carbs) / 4);
  const fatTargetG = Math.round((goalKcal * split.fat) / 9);

  return {
    bmrKcal,
    tdeeKcal,
    goalKcal,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    trainingBonusKcal,
  };
}
