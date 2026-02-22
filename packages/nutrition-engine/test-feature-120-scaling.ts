/**
 * TEST FILE FOR FEATURE #120: Agent 4 scales portions to match targets
 *
 * This test verifies that Agent 4 adjusts serving sizes if actual kcal
 * differs from target by >20%.
 */

import { NutritionCompiler } from './src/agents/nutrition-compiler';
import { FatSecretAdapter } from './src/adapters/fatsecret';
import type { MealPlanDraft } from './src/types/schemas';

// Test data: Meal where FatSecret food has different calories than target
const testMeal = {
  slot: 'breakfast',
  name: 'Oatmeal with Nuts',
  cuisine: 'american',
  prepTimeMin: 10,
  cookTimeMin: 5,
  estimatedNutrition: {
    kcal: 650, // AI estimate (above target)
    proteinG: 20,
    carbsG: 85,
    fatG: 18,
  },
  targetNutrition: {
    kcal: 500, // Target is 500 kcal
    proteinG: 18,
    carbsG: 65,
    fatG: 14,
  },
  foodSearchQuery: 'oats rolled dry',
  suggestedServings: 1,
  primaryProtein: 'mixed',
  tags: ['vegetarian'],
};

const testDay = {
  dayNumber: 1,
  dayName: 'Monday',
  isTrainingDay: false,
  targetKcal: 2000,
  meals: [testMeal],
};

const testDraft: MealPlanDraft = {
  days: [testDay],
  varietyReport: {
    proteinsUsed: ['mixed'],
    cuisinesUsed: ['american'],
    recipeIdsUsed: ['oatmeal-test'],
  },
};

async function testPortionScaling() {
  console.log('=== FEATURE #120: Agent 4 Portion Scaling Test ===\n');

  // Use real LocalFoodDatabase which has 'Oats, Rolled, Dry' with 379 kcal per 100g
  // For a 40g serving (1/2 cup): 152 kcal
  // Our target is 500 kcal, so we need to scale up: 500/152 = 3.29x

  const compiler = new NutritionCompiler(new FatSecretAdapter('...', '...'));

  console.log('TEST INPUT:');
  console.log('- Target calories: 500 kcal');
  console.log('- Search query: "oats rolled dry"');
  console.log('- Expected: Scale portion to match 500 kcal target\n');

  try {
    const compiled = await compiler.compile(testDraft);

    const meal = compiled.days[0].meals[0];

    console.log('RESULT:');
    console.log(`- Meal name: ${meal.name}`);
    console.log(`- Actual calories: ${meal.nutrition.kcal} kcal`);
    console.log(`- Confidence level: ${meal.confidenceLevel}`);
    console.log(`- Ingredients: ${meal.ingredients.length}`);

    // Check ingredients
    const mainIngredient = meal.ingredients.find(
      (i) => i.name.includes('Oat') || i.name.includes('oat')
    );
    if (mainIngredient) {
      console.log(`- Main ingredient: ${mainIngredient.name}`);
      console.log(`- Main ingredient amount: ${mainIngredient.amount} ${mainIngredient.unit}`);
    }

    // Check if portion was scaled to match target
    const variance = (Math.abs(meal.nutrition.kcal - 500) / 500) * 100;

    console.log(`\n- Variance from target: ${variance.toFixed(1)}%`);
    console.log(`- Target was 500 kcal, got ${meal.nutrition.kcal} kcal`);

    // Test assertions
    console.log('\nTEST ASSERTIONS:');

    const assertions = [
      {
        name: 'Portion scaled to match target kcal',
        pass: variance <= 15, // Allow 15% variance
        message: `Variance ${variance.toFixed(1)}% should be ≤ 15%`,
      },
      {
        name: 'Ingredients have amounts',
        pass: meal.ingredients.length > 0 && meal.ingredients.every((i) => i.amount > 0),
        message: 'All ingredients should have amounts > 0',
      },
      {
        name: 'Confidence level is set',
        pass: meal.confidenceLevel === 'verified' || meal.confidenceLevel === 'ai_estimated',
        message: `Confidence should be set, got '${meal.confidenceLevel}'`,
      },
    ];

    let passCount = 0;
    for (const assertion of assertions) {
      const status = assertion.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${assertion.name}`);
      if (!assertion.pass) {
        console.log(`  → ${assertion.message}`);
      } else {
        passCount++;
      }
    }

    console.log(`\nRESULT: ${passCount}/${assertions.length} tests passed`);

    if (passCount === assertions.length) {
      console.log('\n✅ FEATURE #120: PASSING\n');
      process.exit(0);
    } else {
      console.log('\n❌ FEATURE #120: FAILING\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

testPortionScaling();
