/**
 * Benchmark Fixtures for the Nutrition Pipeline
 *
 * Provides realistic RawIntakeForm inputs covering the major code paths:
 *   - Fixture A: Cut male with bodyFat (Katch-McArdle BMR path, high_protein macro)
 *   - Fixture B: Maintain female vegan (Mifflin fallback, balanced macro, allergy filtering)
 *   - Fixture C: Bulk male pescatarian (Mifflin fallback, high training volume, 5 meals)
 *   - Fixture D: Fast-path reuse (same intake as A + pre-built MealPlanDraft, skips Agent 3)
 */

import type { RawIntakeForm, MealPlanDraft } from '../types/schemas';

// ============================================================
// Fixture A: Cut Male (bodyFat present -> Katch-McArdle path)
// ============================================================

/**
 * Exercises:
 *   - Katch-McArdle BMR (bodyFatPercent provided)
 *   - g/kg protein for "cut" goal (2.0 g/kg)
 *   - Training day bonus (3 days/week, 45min morning)
 *   - high_protein macro style
 *   - Caloric floor check (cut with deficit)
 *   - Full pipeline: Agents 1-6
 */
export const FIXTURE_A: RawIntakeForm = {
  name: 'Bench A',
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 85,
  bodyFatPercent: 18,
  goalType: 'cut',
  goalRate: 1.0,
  activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday'],
  trainingTime: 'morning',
  dietaryStyle: 'omnivore',
  allergies: [],
  exclusions: [],
  cuisinePreferences: [],
  mealsPerDay: 4,
  snacksPerDay: 1,
  cookingSkill: 7,
  prepTimeMaxMin: 45,
  macroStyle: 'high_protein',
  planDurationDays: 7,
};

// ============================================================
// Fixture B: Maintain Female Vegan (no bodyFat -> Mifflin path)
// ============================================================

/**
 * Exercises:
 *   - Mifflin-St Jeor BMR (no bodyFatPercent)
 *   - g/kg protein for "maintain" goal (1.8 g/kg)
 *   - Sex-specific fiber floor (female: 25g)
 *   - Vegan dietary style (allergy: tree nuts)
 *   - CacheWarmer dietary filtering
 *   - balanced macro style
 *   - Full pipeline: Agents 1-6
 */
export const FIXTURE_B: RawIntakeForm = {
  name: 'Bench B',
  sex: 'female',
  age: 28,
  heightCm: 165,
  weightKg: 62,
  goalType: 'maintain',
  goalRate: 0,
  activityLevel: 'lightly_active',
  trainingDays: ['tuesday', 'thursday'],
  trainingTime: 'evening',
  dietaryStyle: 'vegan',
  allergies: ['tree nuts'],
  exclusions: [],
  cuisinePreferences: [],
  mealsPerDay: 3,
  snacksPerDay: 2,
  cookingSkill: 5,
  prepTimeMaxMin: 30,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

// ============================================================
// Fixture C: Bulk Pescatarian (high training volume)
// ============================================================

/**
 * Exercises:
 *   - Mifflin-St Jeor BMR (no bodyFatPercent)
 *   - g/kg protein for "bulk" goal (1.7 g/kg)
 *   - High training volume (5 days/week)
 *   - Training day bonus (very_active, morning)
 *   - Sex-specific fiber floor (male: 38g)
 *   - Pescatarian dietary style
 *   - 5 meals/day (max meal targets)
 *   - Full pipeline: Agents 1-6
 */
export const FIXTURE_C: RawIntakeForm = {
  name: 'Bench C',
  sex: 'male',
  age: 25,
  heightCm: 175,
  weightKg: 70,
  goalType: 'bulk',
  goalRate: 0.5,
  activityLevel: 'very_active',
  trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  trainingTime: 'morning',
  dietaryStyle: 'pescatarian',
  allergies: [],
  exclusions: [],
  cuisinePreferences: [],
  mealsPerDay: 5,
  snacksPerDay: 2,
  cookingSkill: 8,
  prepTimeMaxMin: 60,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

// ============================================================
// Fixture D: Fast Path (reuse existing draft, skip Agent 3)
// ============================================================

/**
 * Same intake as Fixture A, paired with a pre-built MealPlanDraft.
 *
 * Exercises:
 *   - runFast() path (Agents 1, 2, 4, 5, 6 -- skips Agent 3 RecipeCurator)
 *   - Existing draft reuse for calorie/macro recalculation
 *   - NutritionCompiler with pre-populated meals
 *   - QA validation on recompiled plan
 */
export const FIXTURE_D_INPUT: RawIntakeForm = { ...FIXTURE_A };

/** Pre-built 7-day MealPlanDraft for fast-path benchmarking */
export const FIXTURE_D_DRAFT: MealPlanDraft = buildFastPathDraft();

// ============================================================
// Draft builder for Fixture D
// ============================================================

function buildFastPathDraft(): MealPlanDraft {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const trainingDayNums = [1, 3, 5]; // Mon, Wed, Fri per Fixture A

  // Realistic per-meal calorie targets for a ~2200 kcal cut diet, 4 meals + 1 snack
  // Meal splits: breakfast ~25%, lunch ~30%, snack ~10%, dinner ~35%
  const dailyKcal = 2200;
  const slots = [
    { slot: 'breakfast', pct: 0.25 },
    { slot: 'lunch', pct: 0.3 },
    { slot: 'snack', pct: 0.1 },
    { slot: 'dinner', pct: 0.35 },
  ];

  // Rotating meal library for variety across 7 days
  const mealLibrary: Record<
    string,
    Array<{
      name: string;
      cuisine: string;
      protein: string;
      query: string;
      tags: string[];
    }>
  > = {
    breakfast: [
      {
        name: 'Scrambled Eggs with Turkey Bacon',
        cuisine: 'American',
        protein: 'eggs',
        query: 'scrambled eggs turkey bacon',
        tags: ['high-protein', 'quick'],
      },
      {
        name: 'Greek Yogurt Protein Bowl',
        cuisine: 'Mediterranean',
        protein: 'greek yogurt',
        query: 'greek yogurt protein bowl',
        tags: ['high-protein', 'no-cook'],
      },
      {
        name: 'Oatmeal with Protein Powder',
        cuisine: 'American',
        protein: 'whey protein',
        query: 'protein oatmeal',
        tags: ['high-protein', 'meal-prep'],
      },
      {
        name: 'Egg White Veggie Omelette',
        cuisine: 'American',
        protein: 'egg whites',
        query: 'egg white omelette vegetables',
        tags: ['high-protein', 'low-fat'],
      },
      {
        name: 'Cottage Cheese Pancakes',
        cuisine: 'American',
        protein: 'cottage cheese',
        query: 'cottage cheese pancakes',
        tags: ['high-protein', 'quick'],
      },
      {
        name: 'Smoked Salmon Bagel Thin',
        cuisine: 'American',
        protein: 'smoked salmon',
        query: 'smoked salmon bagel thin',
        tags: ['high-protein', 'omega-3'],
      },
      {
        name: 'Breakfast Burrito with Chicken',
        cuisine: 'Mexican',
        protein: 'chicken',
        query: 'chicken breakfast burrito',
        tags: ['high-protein', 'meal-prep'],
      },
    ],
    lunch: [
      {
        name: 'Grilled Chicken Salad',
        cuisine: 'American',
        protein: 'chicken breast',
        query: 'grilled chicken salad',
        tags: ['high-protein', 'low-carb'],
      },
      {
        name: 'Turkey and Avocado Wrap',
        cuisine: 'American',
        protein: 'turkey breast',
        query: 'turkey avocado wrap',
        tags: ['high-protein', 'quick'],
      },
      {
        name: 'Tuna Poke Bowl',
        cuisine: 'Japanese',
        protein: 'tuna',
        query: 'tuna poke bowl',
        tags: ['high-protein', 'omega-3'],
      },
      {
        name: 'Chicken Stir-Fry with Rice',
        cuisine: 'Asian',
        protein: 'chicken thigh',
        query: 'chicken stir fry rice',
        tags: ['high-protein', 'meal-prep'],
      },
      {
        name: 'Beef and Broccoli Bowl',
        cuisine: 'Chinese',
        protein: 'lean beef',
        query: 'beef broccoli rice bowl',
        tags: ['high-protein', 'meal-prep'],
      },
      {
        name: 'Shrimp Caesar Salad',
        cuisine: 'Italian',
        protein: 'shrimp',
        query: 'shrimp caesar salad',
        tags: ['high-protein', 'low-carb'],
      },
      {
        name: 'Grilled Chicken Grain Bowl',
        cuisine: 'Mediterranean',
        protein: 'chicken breast',
        query: 'chicken grain bowl quinoa',
        tags: ['high-protein', 'balanced'],
      },
    ],
    snack: [
      {
        name: 'Protein Shake with Banana',
        cuisine: 'American',
        protein: 'whey protein',
        query: 'protein shake banana',
        tags: ['high-protein', 'quick'],
      },
      {
        name: 'Hard-Boiled Eggs with Almonds',
        cuisine: 'American',
        protein: 'eggs',
        query: 'hard boiled eggs almonds',
        tags: ['high-protein', 'no-cook'],
      },
      {
        name: 'Beef Jerky with Apple',
        cuisine: 'American',
        protein: 'beef jerky',
        query: 'beef jerky apple snack',
        tags: ['high-protein', 'portable'],
      },
      {
        name: 'Cottage Cheese with Berries',
        cuisine: 'American',
        protein: 'cottage cheese',
        query: 'cottage cheese berries',
        tags: ['high-protein', 'no-cook'],
      },
      {
        name: 'Turkey Roll-Ups',
        cuisine: 'American',
        protein: 'turkey breast',
        query: 'turkey roll ups cheese',
        tags: ['high-protein', 'no-cook'],
      },
      {
        name: 'Greek Yogurt with Honey',
        cuisine: 'Mediterranean',
        protein: 'greek yogurt',
        query: 'greek yogurt honey',
        tags: ['high-protein', 'quick'],
      },
      {
        name: 'Protein Bar with Mixed Nuts',
        cuisine: 'American',
        protein: 'protein bar',
        query: 'protein bar mixed nuts',
        tags: ['high-protein', 'portable'],
      },
    ],
    dinner: [
      {
        name: 'Grilled Salmon with Sweet Potato',
        cuisine: 'American',
        protein: 'salmon',
        query: 'grilled salmon sweet potato',
        tags: ['high-protein', 'omega-3'],
      },
      {
        name: 'Lean Beef Tacos',
        cuisine: 'Mexican',
        protein: 'lean beef',
        query: 'lean beef tacos',
        tags: ['high-protein', 'family-friendly'],
      },
      {
        name: 'Baked Chicken Thighs with Vegetables',
        cuisine: 'American',
        protein: 'chicken thigh',
        query: 'baked chicken thighs roasted vegetables',
        tags: ['high-protein', 'meal-prep'],
      },
      {
        name: 'Shrimp and Vegetable Pasta',
        cuisine: 'Italian',
        protein: 'shrimp',
        query: 'shrimp vegetable pasta',
        tags: ['high-protein', 'balanced'],
      },
      {
        name: 'Turkey Meatballs with Marinara',
        cuisine: 'Italian',
        protein: 'ground turkey',
        query: 'turkey meatballs marinara',
        tags: ['high-protein', 'meal-prep'],
      },
      {
        name: 'Pork Tenderloin with Asparagus',
        cuisine: 'American',
        protein: 'pork tenderloin',
        query: 'pork tenderloin asparagus',
        tags: ['high-protein', 'lean'],
      },
      {
        name: 'Chicken Tikka Masala with Rice',
        cuisine: 'Indian',
        protein: 'chicken breast',
        query: 'chicken tikka masala rice',
        tags: ['high-protein', 'flavorful'],
      },
    ],
  };

  const proteinsUsed = new Set<string>();
  const cuisinesUsed = new Set<string>();

  const days = dayNames.map((dayName, idx) => {
    const dayNumber = idx + 1;
    const isTrainingDay = trainingDayNums.includes(dayNumber);
    const targetKcal = isTrainingDay ? dailyKcal + 250 : dailyKcal;

    const meals = slots.map(({ slot, pct }) => {
      const mealKcal = Math.round(targetKcal * pct);
      // High-protein split: ~40% protein, 30% carbs, 30% fat
      const proteinG = Math.round((mealKcal * 0.4) / 4);
      const carbsG = Math.round((mealKcal * 0.3) / 4);
      const fatG = Math.round((mealKcal * 0.3) / 9);

      const lib = mealLibrary[slot];
      const entry = lib[idx % lib.length];
      proteinsUsed.add(entry.protein);
      cuisinesUsed.add(entry.cuisine);

      return {
        slot,
        name: entry.name,
        cuisine: entry.cuisine,
        prepTimeMin: slot === 'snack' ? 5 : 15,
        cookTimeMin: slot === 'snack' ? 0 : 20,
        estimatedNutrition: { kcal: mealKcal, proteinG, carbsG, fatG },
        targetNutrition: { kcal: mealKcal, proteinG, carbsG, fatG },
        foodSearchQuery: entry.query,
        suggestedServings: slot === 'snack' ? 1 : 2,
        primaryProtein: entry.protein,
        tags: entry.tags,
        draftIngredients: [],
      };
    });

    return { dayNumber, dayName, isTrainingDay, targetKcal, meals };
  });

  return {
    days,
    varietyReport: {
      proteinsUsed: [...proteinsUsed],
      cuisinesUsed: [...cuisinesUsed],
      recipeIdsUsed: [],
    },
  };
}

// ============================================================
// Fixture Map (for CLI lookup)
// ============================================================

export interface FixtureEntry {
  /** Short identifier */
  id: string;
  /** Human-readable description */
  label: string;
  /** The raw intake form to feed the pipeline */
  input: RawIntakeForm;
  /** Pre-built draft for fast-path testing (only Fixture D) */
  draft?: MealPlanDraft;
  /** Which orchestrator method to call */
  mode: 'full' | 'fast';
}

/** Lookup map keyed by fixture ID for CLI --fixtures argument */
export const FIXTURE_MAP: Record<string, FixtureEntry> = {
  A: {
    id: 'A',
    label: 'Cut Male (Katch-McArdle, high_protein, 4 meals)',
    input: FIXTURE_A,
    mode: 'full',
  },
  B: {
    id: 'B',
    label: 'Maintain Female Vegan (Mifflin, balanced, allergies)',
    input: FIXTURE_B,
    mode: 'full',
  },
  C: {
    id: 'C',
    label: 'Bulk Pescatarian (Mifflin, very_active, 5 meals)',
    input: FIXTURE_C,
    mode: 'full',
  },
  D: {
    id: 'D',
    label: 'Fast Path (skip Agent 3, reuse draft)',
    input: FIXTURE_D_INPUT,
    draft: FIXTURE_D_DRAFT,
    mode: 'fast',
  },
};

/** All fixture IDs in execution order */
export const ALL_FIXTURE_IDS = ['A', 'B', 'C', 'D'] as const;
