/**
 * USDA Adapter Test & Validation Suite
 * Self-contained async test runner -- no test framework needed.
 * Run: cd packages/nutrition-engine && npx tsx test-usda-adapter.ts
 */

import { USDAAdapter } from './src/adapters/usda';
import { FatSecretAdapter } from './src/adapters/fatsecret';
import type { FoodSearchResult, FoodDetails } from './src/adapters/fatsecret';
import { NutritionCompiler } from './src/agents/nutrition-compiler';
import type { MealPlanDraft } from './src/types/schemas';

const API_KEY = process.env.USDA_API_KEY || 'NWdEpt9dGdcd34B4XRcNsirAW2PfTXy5YGpCeRV9';

let passed = 0;
let failed = 0;
let warnings = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

function warn(message: string): void {
  console.log(`  WARN: ${message}`);
  warnings++;
}

// Store results between tests
let searchResult: FoodSearchResult | undefined;
let foodDetails: FoodDetails | undefined;

// ============================================================================
// Test 2a: USDA Search -- "chicken breast"
// ============================================================================
async function test2a() {
  console.log('\n--- Test 2a: USDA Search -- "chicken breast" (maxResults=3) ---');
  const adapter = new USDAAdapter(API_KEY);
  const results = await adapter.searchFoods('chicken breast', 3);

  assert(Array.isArray(results), 'searchFoods returns an array');
  assert(results.length > 0, `results non-empty (got ${results.length})`);
  assert(results.length <= 3, `results.length <= 3 (got ${results.length})`);

  for (const r of results) {
    assert(
      typeof r.foodId === 'string' && r.foodId.length > 0,
      `foodId is non-empty string: "${r.foodId}"`
    );
    assert(
      typeof r.name === 'string' && r.name.length > 0,
      `name is non-empty string: "${r.name}"`
    );
    assert(
      typeof r.description === 'string' && r.description.length > 0,
      `description is non-empty string`
    );
  }

  const hasChicken = results.some((r) => r.name.toLowerCase().includes('chicken'));
  assert(hasChicken, 'at least one result name contains "chicken"');

  // Save first result for subsequent tests
  searchResult = results[0];
}

// ============================================================================
// Test 2b: USDA Food Details -- Full Nutrients
// ============================================================================
async function test2b() {
  console.log('\n--- Test 2b: USDA Food Details -- Full Nutrients ---');
  if (!searchResult) {
    console.log('  SKIP: No search result from test 2a');
    return;
  }

  const adapter = new USDAAdapter(API_KEY);
  const details = await adapter.getFood(searchResult.foodId);

  assert(Array.isArray(details.servings), 'servings is an array');
  assert(details.servings.length > 0, `servings non-empty (got ${details.servings.length})`);

  const base = details.servings[0];
  assert(
    base.servingDescription === '100g',
    `base serving is "100g" (got "${base.servingDescription}")`
  );
  assert(
    base.metricServingAmount === 100,
    `metricServingAmount === 100 (got ${base.metricServingAmount})`
  );
  assert(base.calories > 0, `calories > 0 (got ${base.calories})`);
  assert(base.protein > 0, `protein > 0 (got ${base.protein})`);
  assert(base.fat > 0, `fat > 0 (got ${base.fat})`);
  assert(base.fiber !== undefined, `fiber is defined (got ${base.fiber})`);

  // Save for test 2c
  foodDetails = details;
}

// ============================================================================
// Test 2c: Portions Scaling
// ============================================================================
async function test2c() {
  console.log('\n--- Test 2c: Portions Scaling ---');
  if (!foodDetails) {
    console.log('  SKIP: No food details from test 2b');
    return;
  }

  if (foodDetails.servings.length <= 1) {
    warn('Only 1 serving available -- no portions to check (soft PASS)');
    passed++;
    return;
  }

  assert(foodDetails.servings.length > 1, `multiple servings (got ${foodDetails.servings.length})`);

  const base = foodDetails.servings[0];
  for (let i = 1; i < foodDetails.servings.length; i++) {
    const portion = foodDetails.servings[i];
    const gw = portion.metricServingAmount || 0;
    if (gw <= 0 || base.metricServingAmount === undefined || base.metricServingAmount === 0)
      continue;

    const expectedCal = Math.round((base.calories * gw) / 100);
    const diff = Math.abs(portion.calories - expectedCal);
    assert(
      diff <= 2,
      `portion[${i}] calories (${portion.calories}) ~ expected (${expectedCal}), diff=${diff}`
    );
  }
}

// ============================================================================
// Test 2d: Empty Search Edge Case
// ============================================================================
async function test2d() {
  console.log('\n--- Test 2d: Empty Search Edge Case ---');
  const adapter = new USDAAdapter(API_KEY);
  const results = await adapter.searchFoods('xyzzyspoon123', 5);

  assert(Array.isArray(results), 'returns an array');
  assert(results.length === 0, `empty array for nonsense query (got ${results.length})`);
}

// ============================================================================
// Test 2e: Invalid API Key
// ============================================================================
async function test2e() {
  console.log('\n--- Test 2e: Invalid API Key ---');
  const adapter = new USDAAdapter('INVALID_KEY_12345');

  // isConfigured should be true (key isn't '...' or 'placeholder')
  // We can't call isConfigured directly since it's private, but the behavior is:
  // it should attempt the API call and get a 403
  let caughtError = false;
  try {
    await adapter.searchFoods('chicken', 3);
  } catch (err) {
    caughtError = true;
    assert(err instanceof Error, `error is an Error instance`);
    assert(
      (err as Error).message.includes('USDA API error'),
      `error message contains "USDA API error" (got "${(err as Error).message}")`
    );
  }

  assert(caughtError, 'API call with invalid key threw an error');
}

// ============================================================================
// Test 2f: Cache Verification
// ============================================================================
async function test2f() {
  console.log('\n--- Test 2f: Cache Verification ---');
  const adapter = new USDAAdapter(API_KEY);
  adapter.clearCaches();

  // First call -- cache miss
  const results1 = await adapter.searchFoods('chicken breast', 3);
  assert(results1.length > 0, `first call returns results (${results1.length})`);

  // Second identical call -- cache hit
  const results2 = await adapter.searchFoods('chicken breast', 3);
  assert(results2.length > 0, `second call returns results (${results2.length})`);

  const stats = adapter.getCacheStats();
  assert(stats.searchHits >= 1, `searchHits >= 1 (got ${stats.searchHits})`);
  assert(stats.searchMisses === 1, `searchMisses === 1 (got ${stats.searchMisses})`);
}

// ============================================================================
// Test 2g: Integration -- NutritionCompiler Fallback Chain
// ============================================================================
async function test2g() {
  console.log('\n--- Test 2g: Integration -- NutritionCompiler USDA Fallback ---');

  // Subclass FatSecretAdapter to force empty results
  class EmptyFatSecretAdapter extends FatSecretAdapter {
    constructor() {
      super('...', '...');
    }
    override async searchFoods(): Promise<FoodSearchResult[]> {
      return [];
    }
    override async getFood(): Promise<FoodDetails> {
      throw new Error('Not available');
    }
  }

  const fakeFatSecret = new EmptyFatSecretAdapter();
  const usdaAdapter = new USDAAdapter(API_KEY);
  const compiler = new NutritionCompiler(fakeFatSecret, usdaAdapter);

  const draft: MealPlanDraft = {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: false,
        targetKcal: 400,
        meals: [
          {
            slot: 'lunch',
            name: 'Atlantic Salmon Fillet',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 15,
            estimatedNutrition: { kcal: 400, proteinG: 40, carbsG: 0, fatG: 25 },
            targetNutrition: { kcal: 400, proteinG: 40, carbsG: 0, fatG: 25 },
            fatsecretSearchQuery: 'raw atlantic salmon fillet',
            suggestedServings: 1,
            primaryProtein: 'salmon',
            tags: ['grill'],
          },
        ],
      },
    ],
    varietyReport: {
      proteinsUsed: ['salmon'],
      cuisinesUsed: ['American'],
      recipeIdsUsed: [],
    },
  };

  const compiled = await compiler.compile(draft);
  const meal = compiled.days[0].meals[0];

  assert(
    meal.confidenceLevel === 'verified',
    `confidenceLevel === "verified" (got "${meal.confidenceLevel}")`
  );
  assert(
    meal.fatsecretRecipeId !== undefined && meal.fatsecretRecipeId.startsWith('usda-'),
    `fatsecretRecipeId starts with "usda-" (got "${meal.fatsecretRecipeId}")`
  );
  assert(meal.nutrition.kcal > 0, `nutrition.kcal > 0 (got ${meal.nutrition.kcal})`);
  assert(meal.nutrition.proteinG > 0, `nutrition.proteinG > 0 (got ${meal.nutrition.proteinG})`);
}

// ============================================================================
// Main runner
// ============================================================================
async function main() {
  console.log('=== USDA Adapter Test & Validation Suite ===');
  console.log(`API Key: ${API_KEY.slice(0, 8)}...`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await test2a();
    await test2b();
    await test2c();
    await test2d();
    await test2e();
    await test2f();
    await test2g();
  } catch (err) {
    console.error('\nFATAL ERROR:', err);
    failed++;
  }

  console.log('\n=== Summary ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`WARNINGS: ${warnings}`);
  console.log(`RESULT: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
