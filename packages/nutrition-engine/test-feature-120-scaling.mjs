/**
 * TEST FILE FOR FEATURE #120: Agent 4 scales portions to match targets
 *
 * This test verifies that Agent 4 adjusts serving sizes if actual kcal
 * differs from target by >20%.
 */

import { NutritionCompiler } from './src/agents/nutrition-compiler.js';
import { MockFatSecretAdapter } from './src/adapters/fatsecret.js';

// Test data: Meal with 30% above target calories
const testMeal = {
  slot: 'breakfast',
  name: 'Oatmeal with Nuts and Berries',
  cuisine: 'american',
  prepTimeMin: 10,
  cookTimeMin: 5,
  estimatedNutrition: {
    kcal: 650, // 30% above target of 500
    proteinG: 20,
    carbsG: 85,
    fatG: 18,
  },
  foodSearchQuery: 'oatmeal with nuts',
  suggestedServings: 1,
  primaryProtein: 'mixed',
  tags: ['vegetarian', 'meal-prep'],
  // ADD THIS: Target nutrition for proper scaling
  targetNutrition: {
    kcal: 500, // Target is 500 kcal
    proteinG: 18,
    carbsG: 65,
    fatG: 14,
  },
};

const testDay = {
  dayNumber: 1,
  dayName: 'monday',
  isTrainingDay: false,
  targetKcal: 2000,
  meals: [testMeal],
};

const testDraft = {
  days: [testDay],
  varietyReport: {
    proteinsUsed: ['mixed'],
    cuisinesUsed: ['american'],
    recipeIdsUsed: ['oatmeal-with-nuts'],
  },
};

async function testPortionScaling() {
  console.log('=== FEATURE #120: Agent 4 Portion Scaling Test ===\n');

  // Create mock adapter that returns fixed nutrition
  const mockAdapter = new MockFatSecretAdapter();

  // Mock search results - return oatmeal with 600 kcal per serving
  mockAdapter.searchFoods = async (query, maxResults) => {
    return [
      {
        foodId: 'oatmeal-test',
        name: 'Oatmeal with Nuts and Berries',
        calories: 600,
        protein: 22,
        carbohydrate: 90,
        fat: 20,
      },
    ];
  };

  mockAdapter.getFood = async (foodId) => {
    return {
      foodId: 'oatmeal-test',
      name: 'Oatmeal with Nuts and Berries',
      servings: [
        {
          servingId: 'serving_1',
          servingDescription: '1 bowl (300g)',
          metricServingAmount: 300,
          metricServingUnit: 'g',
          calories: 600,
          protein: 22,
          carbohydrate: 90,
          fat: 20,
          fiber: 10,
        },
      ],
    };
  };

  const compiler = new NutritionCompiler(mockAdapter);

  console.log('TEST INPUT:');
  console.log('- Target calories: 500 kcal');
  console.log('- FatSecret serving: 600 kcal (20% above target)');
  console.log('- Expected: Scale down to ~500 kcal\n');

  try {
    const compiled = await compiler.compile(testDraft);

    const meal = compiled.days[0].meals[0];

    console.log('RESULT:');
    console.log(`- Meal name: ${meal.name}`);
    console.log(`- Actual calories: ${meal.nutrition.kcal} kcal`);
    console.log(`- Scaling factor applied: ${(meal.nutrition.kcal / 600).toFixed(3)}`);
    console.log(`- Ingredients scaled: ${meal.ingredients.length}`);

    // Check if portion was scaled down
    const scale = meal.nutrition.kcal / 600;
    const variance = (Math.abs(meal.nutrition.kcal - 500) / 500) * 100;

    console.log(`\n- Variance from target: ${variance.toFixed(1)}%`);

    // Check if ingredients were adjusted
    const mainIngredient = meal.ingredients.find((i) => i.name.includes('Oatmeal'));
    if (mainIngredient) {
      console.log(`- Main ingredient amount: ${mainIngredient.amount} ${mainIngredient.unit}`);
      console.log(`- Expected scale: ~${((500 / 600) * 300).toFixed(0)}g (scaled from 300g)`);
    }

    // Test assertions
    console.log('\nTEST ASSERTIONS:');

    const assertions = [
      {
        name: 'Portion scaled down',
        pass: scale < 1 && scale > 0,
        message: `Scale factor ${scale.toFixed(3)} should be < 1.0`,
      },
      {
        name: 'Scaled kcal within 10% of target',
        pass: variance <= 10,
        message: `Variance ${variance.toFixed(1)}% should be ≤ 10%`,
      },
      {
        name: 'Ingredients adjusted proportionally',
        pass: mainIngredient && mainIngredient.amount < 300 && mainIngredient.amount > 200,
        message: `Ingredient ${mainIngredient?.amount}g should be < 300g and > 200g`,
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
