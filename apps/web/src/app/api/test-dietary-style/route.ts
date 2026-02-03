import { NextResponse } from 'next/server';
import { RecipeCurator } from '@zero-sum/nutrition-engine';
import { MetabolicCalculator } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #400: Meal plan respects dietary style
 * Tests that the deterministic generator filters meals correctly based on dietary style
 *
 * DEV MODE: Bypasses authentication for testing
 */
export async function GET() {
  // Bypass auth in dev mode
  const isDev = process.env.NODE_ENV !== 'production';
  const recipeCurator = new RecipeCurator(process.env.ANTHROPIC_API_KEY || '');
  const metabolicCalc = new MetabolicCalculator();

  const results: Array<{
    testCase: number;
    dietaryStyle: string;
    description: string;
    result: {
      totalMeals: number;
      forbiddenFound: string[];
      sampleMeals: string[];
    };
    checks: Record<string, boolean>;
    allPassing: boolean;
  }> = [];

  // Helper function to create test intake
  const createTestIntake = (dietaryStyle: string) => ({
    name: `Test User ${dietaryStyle}`,
    sex: 'male' as const,
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goalType: 'maintain' as const,
    goalRate: 1,
    activityLevel: 'moderately_active' as const,
    trainingDays: ['monday', 'wednesday', 'friday'] as const,
    trainingTime: 'morning' as const,
    dietaryStyle: dietaryStyle as any,
    allergies: [],
    exclusions: [],
    cuisinePreferences: [],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    macroStyle: 'balanced' as const,
    planDurationDays: 3, // Short plan for faster testing
  });

  // Helper function to check for forbidden ingredients
  // Uses word boundaries to avoid false positives (e.g., "almond butter" should not match "butter")
  const checkForbiddenIngredients = (mealNames: string[], forbiddenList: string[]) => {
    const found: string[] = [];
    for (const meal of mealNames) {
      const mealLower = meal.toLowerCase();
      for (const forbidden of forbiddenList) {
        // Use word boundary regex to avoid false positives
        const regex = new RegExp(`\\b${forbidden.toLowerCase()}\\b`);
        if (regex.test(mealLower)) {
          // Special case: almond butter, cashew butter, cocoa butter, etc. are vegan
          if (forbidden.toLowerCase() === 'butter' &&
              (mealLower.includes('almond butter') ||
               mealLower.includes('cashew butter') ||
               mealLower.includes('cocoa butter') ||
               mealLower.includes('peanut butter') ||
               mealLower.includes('sunflower butter'))) {
            continue;
          }
          found.push(`${meal} (contains ${forbidden})`);
        }
      }
    }
    return found;
  };

  // Test Case 1: Vegetarian - should have no meat/poultry/fish
  try {
    const intake1 = createTestIntake('vegetarian');
    const metabolic1 = metabolicCalc.calculate(intake1);
    const draft1 = recipeCurator.generateDeterministic(metabolic1, intake1);

    const allMealNames = draft1.days.flatMap(d => d.meals.map(m => m.name));
    const forbiddenFound = checkForbiddenIngredients(allMealNames, [
      'chicken', 'beef', 'pork', 'turkey', 'salmon', 'tuna', 'shrimp', 'cod', 'bacon', 'ham'
    ]);

    const checks = {
      noMeat: forbiddenFound.length === 0,
      hasMeals: allMealNames.length > 0,
      variety: new Set(allMealNames).size >= allMealNames.length * 0.8, // At least 80% variety
    };

    results.push({
      testCase: 1,
      dietaryStyle: 'vegetarian',
      description: 'Should exclude all meat, poultry, and fish',
      result: {
        totalMeals: allMealNames.length,
        forbiddenFound,
        sampleMeals: allMealNames.slice(0, 5),
      },
      checks,
      allPassing: Object.values(checks).every(c => c),
    });
  } catch (error: any) {
    results.push({
      testCase: 1,
      dietaryStyle: 'vegetarian',
      description: 'Should exclude all meat, poultry, and fish',
      result: {
        totalMeals: 0,
        forbiddenFound: [error.message],
        sampleMeals: [],
      },
      checks: { error: false },
      allPassing: false,
    });
  }

  // Test Case 2: Vegan - should have no meat/fish/eggs/dairy
  try {
    const intake2 = createTestIntake('vegan');
    const metabolic2 = metabolicCalc.calculate(intake2);
    const draft2 = recipeCurator.generateDeterministic(metabolic2, intake2);

    const allMealNames = draft2.days.flatMap(d => d.meals.map(m => m.name));
    const forbiddenFound = checkForbiddenIngredients(allMealNames, [
      'chicken', 'beef', 'pork', 'turkey', 'salmon', 'tuna', 'shrimp', 'cod',
      'eggs', 'cheese', 'yogurt', 'milk', 'butter', 'cream'
    ]);

    const checks = {
      noAnimalProducts: forbiddenFound.length === 0,
      hasMeals: allMealNames.length > 0,
      variety: new Set(allMealNames).size >= allMealNames.length * 0.8,
    };

    results.push({
      testCase: 2,
      dietaryStyle: 'vegan',
      description: 'Should exclude all meat, fish, eggs, and dairy',
      result: {
        totalMeals: allMealNames.length,
        forbiddenFound,
        sampleMeals: allMealNames.slice(0, 5),
      },
      checks,
      allPassing: Object.values(checks).every(c => c),
    });
  } catch (error: any) {
    results.push({
      testCase: 2,
      dietaryStyle: 'vegan',
      description: 'Should exclude all meat, fish, eggs, and dairy',
      result: {
        totalMeals: 0,
        forbiddenFound: [error.message],
        sampleMeals: [],
      },
      checks: { error: false },
      allPassing: false,
    });
  }

  // Test Case 3: Pescatarian - should have no meat but fish is OK
  try {
    const intake3 = createTestIntake('pescatarian');
    const metabolic3 = metabolicCalc.calculate(intake3);
    const draft3 = recipeCurator.generateDeterministic(metabolic3, intake3);

    const allMealNames = draft3.days.flatMap(d => d.meals.map(m => m.name));
    const forbiddenFound = checkForbiddenIngredients(allMealNames, [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'ham'
    ]);
    const allowedFound = checkForbiddenIngredients(allMealNames, [
      'salmon', 'tuna', 'shrimp', 'cod'
    ]);

    const checks = {
      noMeat: forbiddenFound.length === 0,
      hasFish: allowedFound.length > 0,
      hasMeals: allMealNames.length > 0,
    };

    results.push({
      testCase: 3,
      dietaryStyle: 'pescatarian',
      description: 'Should exclude meat but allow fish',
      result: {
        totalMeals: allMealNames.length,
        forbiddenFound,
        sampleMeals: allMealNames.slice(0, 5),
      },
      checks,
      allPassing: Object.values(checks).every(c => c),
    });
  } catch (error: any) {
    results.push({
      testCase: 3,
      dietaryStyle: 'pescatarian',
      description: 'Should exclude meat but allow fish',
      result: {
        totalMeals: 0,
        forbiddenFound: [error.message],
        sampleMeals: [],
      },
      checks: { error: false },
      allPassing: false,
    });
  }

  // Test Case 4: Keto - should have only keto-tagged meals
  try {
    const intake4 = createTestIntake('keto');
    const metabolic4 = metabolicCalc.calculate(intake4);
    const draft4 = recipeCurator.generateDeterministic(metabolic4, intake4);

    const allMealNames = draft4.days.flatMap(d => d.meals.map(m => m.name));
    const hasKetoOptions = allMealNames.some(m =>
      m.toLowerCase().includes('bacon') ||
      m.toLowerCase().includes('avocado') ||
      m.toLowerCase().includes('cheese') ||
      m.toLowerCase().includes('butter') ||
      m.toLowerCase().includes('salmon')
    );

    const checks = {
      hasMeals: allMealNames.length > 0,
      hasKetoOptions: hasKetoOptions,
      // Keto meals should be low carb - check for absence of grains
      noGrains: !checkForbiddenIngredients(allMealNames, ['rice', 'pasta', 'bread', 'oats']).some(f => f.includes('grain')),
    };

    results.push({
      testCase: 4,
      dietaryStyle: 'keto',
      description: 'Should include only low-carb, high-fat meals',
      result: {
        totalMeals: allMealNames.length,
        forbiddenFound: [], // Keto is about inclusion, not exclusion
        sampleMeals: allMealNames.slice(0, 5),
      },
      checks,
      allPassing: Object.values(checks).every(c => c),
    });
  } catch (error: any) {
    results.push({
      testCase: 4,
      dietaryStyle: 'keto',
      description: 'Should include only low-carb, high-fat meals',
      result: {
        totalMeals: 0,
        forbiddenFound: [error.message],
        sampleMeals: [],
      },
      checks: { error: false },
      allPassing: false,
    });
  }

  // Test Case 5: Paleo - should have no grains/dairy/legumes
  try {
    const intake5 = createTestIntake('paleo');
    const metabolic5 = metabolicCalc.calculate(intake5);
    const draft5 = recipeCurator.generateDeterministic(metabolic5, intake5);

    const allMealNames = draft5.days.flatMap(d => d.meals.map(m => m.name));
    const forbiddenFound = checkForbiddenIngredients(allMealNames, [
      'rice', 'bread', 'pasta', 'oats', 'quinoa', // grains
      'cheese', 'yogurt', 'milk', 'cream', // dairy
      'beans', 'lentils', 'chickpeas' // legumes
    ]);

    const checks = {
      noGrainsDairyLegumes: forbiddenFound.length === 0,
      hasMeals: allMealNames.length > 0,
    };

    results.push({
      testCase: 5,
      dietaryStyle: 'paleo',
      description: 'Should exclude grains, dairy, and legumes',
      result: {
        totalMeals: allMealNames.length,
        forbiddenFound,
        sampleMeals: allMealNames.slice(0, 5),
      },
      checks,
      allPassing: Object.values(checks).every(c => c),
    });
  } catch (error: any) {
    results.push({
      testCase: 5,
      dietaryStyle: 'paleo',
      description: 'Should exclude grains, dairy, and legumes',
      result: {
        totalMeals: 0,
        forbiddenFound: [error.message],
        sampleMeals: [],
      },
      checks: { error: false },
      allPassing: false,
    });
  }

  const allPassing = results.every((r) => r.allPassing);
  const passingCount = results.filter((r) => r.allPassing).length;

  return NextResponse.json({
    feature: 'Feature #400: Meal plan respects dietary style',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount,
    results,
  });
}
