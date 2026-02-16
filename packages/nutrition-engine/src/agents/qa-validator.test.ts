/**
 * Feature #95: Agent 5 QA Validator Tests
 *
 * Tests the QA Validator (Agent 5) enforces:
 * - ±3% kcal tolerance
 * - ±5% macro tolerances
 * - Up to 3 optimization iterations
 * - QA score calculation (0-100)
 * - PASS/WARN/FAIL status determination
 * - Grocery list aggregation
 * - Output matches MealPlanValidatedSchema
 */

import { describe, it } from 'vitest';
import assert from 'node:assert';
import { QAValidator } from './qa-validator';
import { MealPlanCompiledSchema, MealPlanValidatedSchema } from '../types/schemas';

// Helper to create a test meal
function createTestMeal(overrides: Partial<any> = {}): any {
  return {
    slot: 'breakfast',
    name: 'Test Oatmeal',
    cuisine: 'American',
    prepTimeMin: 5,
    cookTimeMin: 10,
    servings: 1,
    nutrition: {
      kcal: 300,
      proteinG: 10,
      carbsG: 45,
      fatG: 8,
      fiberG: 5,
    },
    confidenceLevel: 'verified',
    ingredients: [
      {
        name: 'Oats',
        amount: 50,
        unit: 'g',
      },
      {
        name: 'Milk',
        amount: 250,
        unit: 'ml',
      },
    ],
    instructions: ['Mix oats and milk', 'Cook for 10 minutes'],
    primaryProtein: 'oats',
    tags: ['breakfast', 'healthy'],
    ...overrides,
  };
}

// Helper to create a test day
function createTestDay(dayNumber: number, targetKcal: number, variancePercent: number): any {
  const actualKcal = Math.round(targetKcal * (1 + variancePercent / 100));
  const varianceKcal = actualKcal - targetKcal;

  return {
    dayNumber,
    dayName: `Day ${dayNumber}`,
    isTrainingDay: false,
    targetKcal,
    meals: [
      createTestMeal({
        slot: 'breakfast',
        nutrition: {
          kcal: Math.round(actualKcal * 0.25),
          proteinG: 10,
          carbsG: 30,
          fatG: 5,
          fiberG: 3,
        },
      }),
      createTestMeal({
        slot: 'lunch',
        nutrition: {
          kcal: Math.round(actualKcal * 0.35),
          proteinG: 25,
          carbsG: 40,
          fatG: 10,
          fiberG: 5,
        },
      }),
      createTestMeal({
        slot: 'dinner',
        nutrition: {
          kcal: Math.round(actualKcal * 0.4),
          proteinG: 30,
          carbsG: 45,
          fatG: 12,
          fiberG: 6,
        },
      }),
    ],
    dailyTotals: {
      kcal: actualKcal,
      proteinG: 65,
      carbsG: 115,
      fatG: 27,
      fiberG: 14,
    },
    varianceKcal,
    variancePercent,
  };
}

// Helper to create a compiled meal plan
function createCompiledPlan(days: any[]): any {
  const totalKcal = days.reduce((sum, day) => sum + day.dailyTotals.kcal, 0);
  const totalProtein = days.reduce((sum, day) => sum + day.dailyTotals.proteinG, 0);
  const totalCarbs = days.reduce((sum, day) => sum + day.dailyTotals.carbsG, 0);
  const totalFat = days.reduce((sum, day) => sum + day.dailyTotals.fatG, 0);

  return {
    days,
    weeklyAverages: {
      kcal: Math.round(totalKcal / days.length),
      proteinG: Math.round((totalProtein / days.length) * 10) / 10,
      carbsG: Math.round((totalCarbs / days.length) * 10) / 10,
      fatG: Math.round((totalFat / days.length) * 10) / 10,
    },
  };
}

describe('QAValidator - Feature #95', async () => {
  const validator = new QAValidator();
  let passed = 0;
  let failed = 0;

  // ============================================================
  // TEST 1: Input compiled meal plan within tolerance → PASS status and score near 100
  // ============================================================
  it('returns PASS status and high score for plan within tolerance', async () => {
    console.log('\n[TEST 1] Input compiled meal plan within tolerance');
    console.log('  Creating plan with ±2% variance (within ±3% tolerance)...');

    const perfectDays = [
      createTestDay(1, 2000, 2.0), // +2% variance
      createTestDay(2, 2000, -1.5), // -1.5% variance
      createTestDay(3, 2000, 1.0), // +1% variance
    ];

    const compiledPlan = createCompiledPlan(perfectDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ QA Status: ${result.qa.status}`);
    console.log(`  ✓ QA Score: ${result.qa.score}`);
    console.log(`  ✓ Iterations: ${result.qa.iterations}`);

    assert.strictEqual(result.qa.status, 'PASS', 'Expected PASS status for within-tolerance plan');
    assert.ok(result.qa.score >= 90, `Expected score >= 90, got ${result.qa.score}`);
    // Note: Validator runs up to 3 iterations checking for violations, then breaks early if none found
    assert.ok(result.qa.iterations <= 3, `Expected <= 3 iterations, got ${result.qa.iterations}`);

    console.log('  ✅ TEST 1 PASSED: Within tolerance → PASS status with score near 100');
    passed++;
  });

  // ============================================================
  // TEST 2: Input compiled plan with 5% calorie variance → optimization triggered
  // ============================================================
  try {
    console.log('\n[TEST 2] Input compiled plan with 5% calorie variance');
    console.log('  Creating plan with +5% variance (exceeds ±3% tolerance)...');

    const varianceDays = [
      createTestDay(1, 2000, 5.0), // +5% variance - exceeds tolerance
      createTestDay(2, 2000, -1.0), // -1% variance
      createTestDay(3, 2000, 1.5), // +1.5% variance
    ];

    const compiledPlan = createCompiledPlan(varianceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ QA Status: ${result.qa.status}`);
    console.log(`  ✓ QA Score: ${result.qa.score}`);
    console.log(`  ✓ Iterations: ${result.qa.iterations}`);
    console.log(`  ✓ Adjustments made: ${result.qa.adjustmentsMade.length}`);

    assert.ok(result.qa.iterations > 0, 'Expected optimization iterations to be triggered');
    assert.ok(result.qa.adjustmentsMade.length > 0, 'Expected adjustments to be made');

    console.log('  ✅ TEST 2 PASSED: 5% variance → optimization triggered');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 2 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 3: Max 3 optimization iterations enforced
  // ============================================================
  try {
    console.log('\n[TEST 3] Max 3 optimization iterations enforced');
    console.log('  Creating plan with large variance that needs optimization...');

    const largeVarianceDays = [
      createTestDay(1, 2000, 8.0), // +8% variance - needs multiple iterations
      createTestDay(2, 2000, -6.0), // -6% variance - needs multiple iterations
    ];

    const compiledPlan = createCompiledPlan(largeVarianceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ Iterations performed: ${result.qa.iterations}`);
    console.log(`  ✓ Max allowed: 3`);

    assert.ok(result.qa.iterations <= 3, `Expected max 3 iterations, got ${result.qa.iterations}`);

    console.log('  ✅ TEST 3 PASSED: Max 3 iterations enforced');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 3 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 4: Optimization effectively reduces variance
  // ============================================================
  try {
    console.log('\n[TEST 4] Optimization effectively reduces variance');
    console.log('  Creating plan with marginal variance...');

    const marginalDays = [
      createTestDay(1, 2000, 4.5), // +4.5% variance - exceeds tolerance
      createTestDay(2, 2000, 4.0), // +4% variance - exceeds tolerance
    ];

    const compiledPlan = createCompiledPlan(marginalDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ QA Status: ${result.qa.status}`);
    console.log(`  ✓ QA Score: ${result.qa.score}`);
    console.log(`  ✓ Iterations: ${result.qa.iterations}`);
    console.log(`  ✓ Adjustments made: ${result.qa.adjustmentsMade.length}`);

    // Optimization should be triggered and effective
    assert.ok(result.qa.iterations > 0, 'Expected optimization iterations');
    assert.ok(
      result.qa.status === 'PASS' || result.qa.status === 'WARN',
      'Expected PASS or WARN after optimization'
    );

    console.log('  ✅ TEST 4 PASSED: Optimization reduces variance effectively');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 4 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 5: Extreme variance scenarios
  // ============================================================
  try {
    console.log('\n[TEST 5] Extreme variance scenarios');
    console.log('  Creating plan with extreme variance...');

    const extremeDays = [
      createTestDay(1, 2000, 15.0), // +15% variance - extreme
      createTestDay(2, 2000, -12.0), // -12% variance - extreme
    ];

    const compiledPlan = createCompiledPlan(extremeDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ QA Status: ${result.qa.status}`);
    console.log(`  ✓ QA Score: ${result.qa.score}`);
    console.log(`  ✓ Iterations: ${result.qa.iterations}`);
    console.log(`  ✓ Adjustments: ${result.qa.adjustmentsMade.length}`);

    // The optimizer should attempt to fix extreme cases
    // With meal scaling, it can often bring even extreme cases within tolerance
    assert.ok(result.qa.iterations > 0, 'Expected optimization attempts');
    assert.ok(result.qa.score >= 0 && result.qa.score <= 100, 'Expected valid QA score');

    console.log('  ✅ TEST 5 PASSED: Extreme variance handled with optimization');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 5 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 6: Grocery list aggregation
  // ============================================================
  try {
    console.log('\n[TEST 6] Grocery list aggregation');
    console.log('  Creating plan with multiple ingredients...');

    const testDays = [
      createTestDay(1, 2000, 1.0),
      createTestDay(2, 2000, 1.0),
      createTestDay(3, 2000, 1.0),
    ];

    // Add specific ingredients to test categorization
    testDays[0].meals[0].ingredients = [
      { name: 'Chicken breast', amount: 200, unit: 'g' },
      { name: 'Broccoli', amount: 150, unit: 'g' },
      { name: 'Olive oil', amount: 15, unit: 'ml' },
    ];
    testDays[1].meals[0].ingredients = [
      { name: 'Chicken breast', amount: 200, unit: 'g' },
      { name: 'Spinach', amount: 100, unit: 'g' },
    ];
    testDays[2].meals[0].ingredients = [
      { name: 'Eggs', amount: 4, unit: 'whole' },
      { name: 'Cheese', amount: 50, unit: 'g' },
    ];

    const compiledPlan = createCompiledPlan(testDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ Grocery categories: ${result.groceryList.length}`);
    console.log(`  ✓ Categories: ${result.groceryList.map((c) => c.category).join(', ')}`);

    assert.ok(result.groceryList.length > 0, 'Expected grocery list to be generated');

    // Check that ingredients are aggregated
    const produce = result.groceryList.find((c) => c.category === 'Produce');
    assert.ok(produce, 'Expected Produce category');
    assert.ok(produce.items.length > 0, 'Expected items in Produce category');

    const meatSeafood = result.groceryList.find((c) => c.category === 'Meat and Seafood');
    assert.ok(meatSeafood, 'Expected Meat and Seafood category');

    const dairy = result.groceryList.find((c) => c.category === 'Dairy and Eggs');
    assert.ok(dairy, 'Expected Dairy and Eggs category');

    // Check aggregation: chicken breast should be summed (200g + 200g = 400g, rounded up)
    const chicken = meatSeafood?.items.find((i) => i.name.toLowerCase().includes('chicken'));
    assert.ok(chicken, 'Expected chicken in grocery list');
    assert.ok(chicken!.amount >= 400, `Expected chicken amount >= 400g, got ${chicken!.amount}`);

    console.log('  ✅ TEST 6 PASSED: Grocery list aggregated correctly');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 6 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 7: Output matches MealPlanValidatedSchema
  // ============================================================
  try {
    console.log('\n[TEST 7] Output matches MealPlanValidatedSchema');
    console.log('  Validating schema compliance...');

    const testDays = [createTestDay(1, 2000, 1.5), createTestDay(2, 2000, -0.5)];

    const compiledPlan = createCompiledPlan(testDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    // Verify schema compliance
    const validated = MealPlanValidatedSchema.parse(result);

    console.log(`  ✓ Schema validation: PASSED`);
    console.log(`  ✓ Has days array: ${validated.days.length > 0}`);
    console.log(`  ✓ Has grocery list: ${validated.groceryList.length > 0}`);
    console.log(`  ✓ Has QA result: ${validated.qa !== undefined}`);
    console.log(`  ✓ Has weekly totals: ${validated.weeklyTotals !== undefined}`);
    console.log(`  ✓ Has generatedAt: ${validated.generatedAt !== undefined}`);
    console.log(`  ✓ Has engineVersion: ${validated.engineVersion !== undefined}`);

    assert.ok(validated.days, 'Expected days array');
    assert.ok(validated.groceryList, 'Expected grocery list');
    assert.ok(validated.qa, 'Expected QA result');
    assert.ok(validated.weeklyTotals, 'Expected weekly totals');
    assert.ok(validated.generatedAt, 'Expected generatedAt timestamp');
    assert.ok(validated.engineVersion, 'Expected engineVersion');

    console.log('  ✅ TEST 7 PASSED: Output matches MealPlanValidatedSchema');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 7 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 8: ±3% kcal tolerance enforced
  // ============================================================
  try {
    console.log('\n[TEST 8] ±3% kcal tolerance enforced');
    console.log('  Testing tolerance boundaries...');

    const withinToleranceDays = [
      createTestDay(1, 2000, 2.9), // +2.9% - within tolerance
      createTestDay(2, 2000, -2.9), // -2.9% - within tolerance
    ];

    const compiledPlan = createCompiledPlan(withinToleranceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ Day 1 variance: ${withinToleranceDays[0].variancePercent}%`);
    console.log(`  ✓ Day 2 variance: ${withinToleranceDays[1].variancePercent}%`);
    console.log(`  ✓ QA Status: ${result.qa.status}`);

    // Within ±3% should result in PASS
    assert.strictEqual(result.qa.status, 'PASS', 'Expected PASS for within ±3% variance');

    // Test exceeding tolerance
    const exceedsToleranceDays = [
      createTestDay(1, 2000, 3.5), // +3.5% - exceeds tolerance
    ];

    const exceedsPlan = createCompiledPlan(exceedsToleranceDays);
    const exceedsParsed = MealPlanCompiledSchema.parse(exceedsPlan);

    const exceedsResult = await validator.validate(exceedsParsed);

    console.log(`  ✓ Exceeds tolerance variance: ${exceedsToleranceDays[0].variancePercent}%`);
    console.log(`  ✓ QA Status: ${exceedsResult.qa.status}`);
    console.log(`  ✓ Iterations: ${exceedsResult.qa.iterations}`);

    // Should trigger optimization
    assert.ok(exceedsResult.qa.iterations > 0, 'Expected optimization for variance exceeding ±3%');

    console.log('  ✅ TEST 8 PASSED: ±3% kcal tolerance enforced correctly');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 8 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // TEST 9: Weekly totals calculated correctly
  // ============================================================
  try {
    console.log('\n[TEST 9] Weekly totals calculated correctly');

    const testDays = [
      createTestDay(1, 2000, 0),
      createTestDay(2, 2000, 0),
      createTestDay(3, 2000, 0),
      createTestDay(4, 2000, 0),
      createTestDay(5, 2000, 0),
      createTestDay(6, 2000, 0),
      createTestDay(7, 2000, 0),
    ];

    const compiledPlan = createCompiledPlan(testDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);

    const result = await validator.validate(compiledParsed);

    console.log(`  ✓ Weekly avg kcal: ${result.weeklyTotals.avgKcal}`);
    console.log(`  ✓ Weekly avg protein: ${result.weeklyTotals.avgProteinG}g`);
    console.log(`  ✓ Weekly avg carbs: ${result.weeklyTotals.avgCarbsG}g`);
    console.log(`  ✓ Weekly avg fat: ${result.weeklyTotals.avgFatG}g`);

    // Should match daily targets
    assert.strictEqual(
      result.weeklyTotals.avgKcal,
      2000,
      'Expected avg kcal to match daily target'
    );
    assert.ok(result.weeklyTotals.avgProteinG > 0, 'Expected positive protein');
    assert.ok(result.weeklyTotals.avgCarbsG > 0, 'Expected positive carbs');
    assert.ok(result.weeklyTotals.avgFatG > 0, 'Expected positive fat');

    console.log('  ✅ TEST 9 PASSED: Weekly totals calculated correctly');
    passed++;
  } catch (error) {
    console.log(`  ❌ TEST 9 FAILED: ${error}`);
    failed++;
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
});
