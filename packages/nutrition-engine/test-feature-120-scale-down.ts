/**
 * TEST: Scale DOWN when FatSecret food has MORE calories than target
 */

import { NutritionCompiler } from './src/agents/nutrition-compiler';
import { FatSecretAdapter } from './src/adapters/fatsecret';
import type { MealPlanDraft } from './src/types/schemas';

// Test: Target 400 kcal, but Chicken Breast has 284 kcal per 172g
// Wait, that's less. Let me use a different food.
// Actually, let's target LESS than what a full serving provides

const testMeal = {
  slot: 'lunch',
  name: 'Chicken Breast',
  cuisine: 'american',
  prepTimeMin: 10,
  cookTimeMin: 20,
  estimatedNutrition: {
    kcal: 300, // AI estimate
    proteinG: 40,
    carbsG: 0,
    fatG: 5,
  },
  targetNutrition: {
    kcal: 200, // Target is ONLY 200 kcal (much less than a full chicken breast)
    proteinG: 35,
    carbsG: 0,
    fatG: 3,
  },
  fatsecretSearchQuery: 'chicken breast grilled',
  suggestedServings: 1,
  primaryProtein: 'chicken',
  tags: ['high-protein'],
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
    proteinsUsed: ['chicken'],
    cuisinesUsed: ['american'],
    recipeIdsUsed: ['chicken-test'],
  },
};

async function testScaleDown() {
  console.log('=== TEST: Scale DOWN portion ===\n');

  const compiler = new NutritionCompiler(new FatSecretAdapter('...', '...'));

  console.log('TEST INPUT:');
  console.log('- Target calories: 200 kcal');
  console.log('- Search: "chicken breast grilled"');
  console.log('- Chicken Breast is 284 kcal per 172g serving');
  console.log('- Expected: Scale DOWN to ~200 kcal\n');

  try {
    const compiled = await compiler.compile(testDraft);
    const meal = compiled.days[0].meals[0];

    console.log('RESULT:');
    console.log(`- Actual calories: ${meal.nutrition.kcal} kcal`);
    console.log(`- Confidence: ${meal.confidenceLevel}`);

    const chicken = meal.ingredients.find((i) => i.name.includes('Chicken'));
    if (chicken) {
      console.log(`- Chicken amount: ${chicken.amount} ${chicken.unit}`);
    }

    // Expected scale: 200/284 = 0.704
    // Expected amount: 172g * 0.704 = 121g
    const variance = (Math.abs(meal.nutrition.kcal - 200) / 200) * 100;
    console.log(`\n- Variance from target: ${variance.toFixed(1)}%`);

    // Check if scaled correctly
    const scale = meal.nutrition.kcal / 284;
    console.log(`- Scale factor: ${scale.toFixed(3)} (expected ~0.704)`);

    if (variance <= 15) {
      console.log('\n✅ PASS: Portion scaled down correctly');
      process.exit(0);
    } else {
      console.log('\n❌ FAIL: Variance too large');
      process.exit(1);
    }
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

testScaleDown();
