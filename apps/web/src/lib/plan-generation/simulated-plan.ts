import { logger } from '@/lib/safe-logger';
import {
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  getTrainingDayBonus,
} from '@/lib/metabolic-utils';
import { SAMPLE_MEALS, ALLERGEN_KEYWORDS, type MealOption } from './sample-meals';

/**
 * Check if a meal name contains any restricted ingredients.
 */
function mealContainsRestrictions(mealName: string, restrictedFoods: Set<string>): boolean {
  const lowerName = mealName.toLowerCase();
  for (const food of restrictedFoods) {
    if (lowerName.includes(food)) return true;
  }
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (restrictedFoods.has(allergen)) {
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) return true;
      }
    }
  }
  return false;
}

/**
 * Filter meal options to only those safe for the user's restrictions.
 */
function getSafeMealOptions(slotOptions: MealOption[], restrictedFoods: Set<string>): MealOption[] {
  if (restrictedFoods.size === 0) return slotOptions;
  return slotOptions.filter((meal) => !mealContainsRestrictions(meal.name, restrictedFoods));
}

/**
 * Generate a realistic simulated meal plan from user profile data.
 * Used in dev mode when there's no real nutrition engine pipeline.
 */
export function generateSimulatedPlan(
  profile: {
    name: string;
    sex: string;
    age: number;
    heightCm: number;
    weightKg: number;
    goalType: string;
    goalRate: number;
    activityLevel: string;
    dietaryStyle: string;
    macroStyle: string;
    mealsPerDay: number;
    snacksPerDay: number;
  },
  startDate: Date,
  allergies: string[] = [],
  exclusions: string[] = [],
  prepTimeMax: number = 30
) {
  const { bmr } = calculateBMR({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  });
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const goalKcal = calculateGoalCalories(tdee, profile.goalType, profile.goalRate);
  const macros = calculateMacroTargets(goalKcal, profile.macroStyle);
  const proteinG = macros.proteinG;
  const carbsG = macros.carbsG;
  const fatG = macros.fatG;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const mealSlots: string[] = [];
  const mainMealLabels = ['Breakfast', 'Lunch', 'Dinner', 'Meal 4', 'Meal 5', 'Meal 6'];
  for (let i = 0; i < profile.mealsPerDay; i++) {
    mealSlots.push(mainMealLabels[i]);
  }
  for (let i = 0; i < profile.snacksPerDay; i++) {
    mealSlots.push(`Snack ${i + 1}`);
  }

  const restrictedFoods = new Set([
    ...allergies.map((a) => a.toLowerCase()),
    ...exclusions.map((e) => e.toLowerCase()),
  ]);

  const days = Array.from({ length: 7 }, (_, idx) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + idx);
    const actualDayName = dayNames[currentDate.getDay()];
    const isTrainingDay = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;
    const dayKcal = isTrainingDay ? goalKcal : Math.round(goalKcal * 0.9);
    const kcalPerMeal = Math.round(dayKcal / mealSlots.length);

    const meals = mealSlots.map((slot) => {
      const allMealOptions =
        SAMPLE_MEALS[slot] ||
        (slot.startsWith('Snack') ? SAMPLE_MEALS['Snack 1'] : SAMPLE_MEALS['Lunch']);
      const safeMealOptions = getSafeMealOptions(allMealOptions, restrictedFoods);

      if (safeMealOptions.length === 0) {
        logger.warn(
          `No safe meals available for ${slot} with restrictions:`,
          Array.from(restrictedFoods)
        );
      }

      const mealOptions = safeMealOptions.length > 0 ? safeMealOptions : allMealOptions;
      const meal = mealOptions[idx % mealOptions.length];
      const mealProtein = Math.round(proteinG / mealSlots.length);
      const mealCarbs = Math.round(carbsG / mealSlots.length);
      const mealFat = Math.round(fatG / mealSlots.length);

      const minPrep = 5;
      const maxPrep = Math.min(25, prepTimeMax);
      const prepTime = minPrep + Math.round(Math.random() * (maxPrep - minPrep));

      return {
        slot: meal.slot,
        name: meal.name,
        cuisine: 'American',
        prepTimeMin: prepTime,
        cookTimeMin: 15 + Math.round(Math.random() * 20),
        nutrition: {
          kcal: kcalPerMeal,
          proteinG: mealProtein,
          carbsG: mealCarbs,
          fatG: mealFat,
          fiberG: 3 + Math.round(Math.random() * 5),
        },
        confidenceLevel: 'verified',
        ingredients: [
          { name: 'Main ingredient', amount: '150g' },
          { name: 'Side ingredient', amount: '100g' },
        ],
        instructions: ['Prepare ingredients', 'Cook according to recipe', 'Plate and serve'],
      };
    });

    return {
      dayNumber: idx + 1,
      dayName: actualDayName,
      isTrainingDay,
      targetKcal: dayKcal,
      meals,
    };
  });

  return {
    days,
    groceryList: [
      { category: 'Protein', items: ['Chicken breast', 'Salmon fillet', 'Greek yogurt', 'Eggs'] },
      { category: 'Grains', items: ['Brown rice', 'Quinoa', 'Whole grain bread', 'Oats'] },
      { category: 'Vegetables', items: ['Spinach', 'Bell peppers', 'Broccoli', 'Sweet potato'] },
      { category: 'Fruits', items: ['Bananas', 'Berries', 'Apples', 'Avocados'] },
    ],
    qa: { status: 'PASS', score: 87, iterations: 2 },
    weeklyTotals: {
      avgKcal: goalKcal,
      avgProteinG: proteinG,
      avgCarbsG: carbsG,
      avgFatG: fatG,
    },
  };
}

/**
 * Calculate simulated metabolic profile from user profile data.
 * Uses canonical utilities to ensure correct calculations.
 */
export function calculateSimulatedMetabolicProfile(profile: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goalType: string;
  goalRate: number;
  activityLevel: string;
  macroStyle?: string;
}) {
  const { bmr } = calculateBMR({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  });
  const bmrKcal = Math.round(bmr);
  const tdeeKcal = calculateTDEE(bmrKcal, profile.activityLevel);
  const goalKcal = calculateGoalCalories(tdeeKcal, profile.goalType, profile.goalRate);
  const macros = calculateMacroTargets(goalKcal, profile.macroStyle || 'balanced');
  const trainingBonusKcal = getTrainingDayBonus(tdeeKcal);

  return {
    bmrKcal,
    tdeeKcal,
    goalKcal,
    proteinTargetG: macros.proteinG,
    carbsTargetG: macros.carbsG,
    fatTargetG: macros.fatG,
    trainingBonusKcal,
  };
}
