/**
 * Agent 5 QA Validator Tests
 *
 * Tests the QA Validator enforces:
 * - ±3% kcal tolerance (with 50 kcal absolute floor)
 * - Per-macro tolerances (P:±10%, C:±15%, F:±15%) [P2-T06]
 * - Single optimization pass [P2-T07]
 * - QA score calculation (0-100)
 * - PASS/WARN/FAIL status determination (kcal + macro combined)
 * - Macro variance recording in day results
 * - Grocery list aggregation
 * - Output matches MealPlanValidatedSchema
 */

import { describe, it, expect } from 'vitest';
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
      { name: 'Oats', amount: 50, unit: 'g' },
      { name: 'Milk', amount: 250, unit: 'ml' },
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
  const totalKcal = days.reduce((sum: number, day: any) => sum + day.dailyTotals.kcal, 0);
  const totalProtein = days.reduce((sum: number, day: any) => sum + day.dailyTotals.proteinG, 0);
  const totalCarbs = days.reduce((sum: number, day: any) => sum + day.dailyTotals.carbsG, 0);
  const totalFat = days.reduce((sum: number, day: any) => sum + day.dailyTotals.fatG, 0);

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

describe('QAValidator', () => {
  const validator = new QAValidator();

  it('returns PASS status and high score for plan within tolerance', async () => {
    const perfectDays = [
      createTestDay(1, 2000, 2.0),
      createTestDay(2, 2000, -1.5),
      createTestDay(3, 2000, 1.0),
    ];

    const compiledPlan = createCompiledPlan(perfectDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.status).toBe('PASS');
    expect(result.qa.score).toBeGreaterThanOrEqual(90);
    expect(result.qa.iterations).toBe(1);
  });

  it('triggers optimization for 5% calorie variance', async () => {
    const varianceDays = [
      createTestDay(1, 2000, 5.0),
      createTestDay(2, 2000, -1.0),
      createTestDay(3, 2000, 1.5),
    ];

    const compiledPlan = createCompiledPlan(varianceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.iterations).toBeGreaterThan(0);
    expect(result.qa.adjustmentsMade.length).toBeGreaterThan(0);
  });

  it('uses single optimization pass (P2-T07)', async () => {
    const largeVarianceDays = [createTestDay(1, 2000, 8.0), createTestDay(2, 2000, -6.0)];

    const compiledPlan = createCompiledPlan(largeVarianceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.iterations).toBe(1);
    expect(result.qa.adjustmentsMade.length).toBeGreaterThan(0);
  });

  it('effectively reduces variance through optimization', async () => {
    const marginalDays = [createTestDay(1, 2000, 4.5), createTestDay(2, 2000, 4.0)];

    const compiledPlan = createCompiledPlan(marginalDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.iterations).toBeGreaterThan(0);
    expect(['PASS', 'WARN']).toContain(result.qa.status);
  });

  it('handles extreme variance scenarios', async () => {
    const extremeDays = [createTestDay(1, 2000, 15.0), createTestDay(2, 2000, -12.0)];

    const compiledPlan = createCompiledPlan(extremeDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.iterations).toBeGreaterThan(0);
    expect(result.qa.score).toBeGreaterThanOrEqual(0);
    expect(result.qa.score).toBeLessThanOrEqual(100);
  });

  it('aggregates grocery list correctly', async () => {
    const testDays = [
      createTestDay(1, 2000, 1.0),
      createTestDay(2, 2000, 1.0),
      createTestDay(3, 2000, 1.0),
    ];

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

    expect(result.groceryList.length).toBeGreaterThan(0);

    const produce = result.groceryList.find((c) => c.category === 'Produce');
    expect(produce).toBeDefined();
    expect(produce!.items.length).toBeGreaterThan(0);

    const meatSeafood = result.groceryList.find((c) => c.category === 'Meat and Seafood');
    expect(meatSeafood).toBeDefined();

    const dairy = result.groceryList.find((c) => c.category === 'Dairy and Eggs');
    expect(dairy).toBeDefined();

    const chicken = meatSeafood?.items.find((i) => i.name.toLowerCase().includes('chicken'));
    expect(chicken).toBeDefined();
    expect(chicken!.amount).toBeGreaterThanOrEqual(400);
  });

  it('output matches MealPlanValidatedSchema', async () => {
    const testDays = [createTestDay(1, 2000, 1.5), createTestDay(2, 2000, -0.5)];

    const compiledPlan = createCompiledPlan(testDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    const validated = MealPlanValidatedSchema.parse(result);

    expect(validated.days).toBeDefined();
    expect(validated.groceryList).toBeDefined();
    expect(validated.qa).toBeDefined();
    expect(validated.weeklyTotals).toBeDefined();
    expect(validated.generatedAt).toBeDefined();
    expect(validated.engineVersion).toBeDefined();
  });

  it('enforces ±3% kcal tolerance', async () => {
    // Within tolerance
    const withinToleranceDays = [createTestDay(1, 2000, 2.9), createTestDay(2, 2000, -2.9)];

    const compiledPlan = createCompiledPlan(withinToleranceDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.status).toBe('PASS');

    // Exceeds tolerance
    const exceedsToleranceDays = [createTestDay(1, 2000, 3.5)];
    const exceedsPlan = createCompiledPlan(exceedsToleranceDays);
    const exceedsParsed = MealPlanCompiledSchema.parse(exceedsPlan);
    const exceedsResult = await validator.validate(exceedsParsed);

    expect(exceedsResult.qa.iterations).toBeGreaterThan(0);
  });

  it('calculates weekly totals correctly', async () => {
    const testDays = Array.from({ length: 7 }, (_, i) => createTestDay(i + 1, 2000, 0));

    const compiledPlan = createCompiledPlan(testDays);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.weeklyTotals.avgKcal).toBe(2000);
    expect(result.weeklyTotals.avgProteinG).toBeGreaterThan(0);
    expect(result.weeklyTotals.avgCarbsG).toBeGreaterThan(0);
    expect(result.weeklyTotals.avgFatG).toBeGreaterThan(0);
  });

  it('flags protein 12% off as non-PASS (exceeds 10% tolerance)', async () => {
    const day = createTestDay(1, 2000, 0);
    day.macroTargets = { proteinG: 150, carbsG: 250, fatG: 67 };
    day.dailyTotals = {
      kcal: 2000,
      proteinG: 168, // +12% over 150g target
      carbsG: 250,
      fatG: 67,
      fiberG: 14,
    };

    const compiledPlan = createCompiledPlan([day]);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.dayResults[0].status).not.toBe('PASS');
  });

  it('passes carbs 12% off (within 15% tolerance)', async () => {
    const day = createTestDay(1, 2000, 0);
    day.macroTargets = { proteinG: 150, carbsG: 250, fatG: 67 };
    day.dailyTotals = {
      kcal: 2000,
      proteinG: 150,
      carbsG: 280, // +12% over 250g target, within 15%
      fatG: 67,
      fiberG: 14,
    };

    const compiledPlan = createCompiledPlan([day]);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.dayResults[0].status).toBe('PASS');
  });

  it('records macroVariances when macroTargets present', async () => {
    const day = createTestDay(1, 2000, 0);
    day.macroTargets = { proteinG: 150, carbsG: 250, fatG: 67 };
    day.dailyTotals = {
      kcal: 2000,
      proteinG: 155,
      carbsG: 245,
      fatG: 70,
      fiberG: 14,
    };

    const compiledPlan = createCompiledPlan([day]);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    const dayResult = result.qa.dayResults[0];
    expect(dayResult.macroVariances).toBeDefined();
    expect(typeof dayResult.macroVariances!.proteinPercent).toBe('number');
    expect(typeof dayResult.macroVariances!.carbsPercent).toBe('number');
    expect(typeof dayResult.macroVariances!.fatPercent).toBe('number');

    // Directional correctness
    expect(dayResult.macroVariances!.proteinPercent).toBeGreaterThan(0); // 155 > 150
    expect(dayResult.macroVariances!.carbsPercent).toBeLessThan(0); // 245 < 250
    expect(dayResult.macroVariances!.fatPercent).toBeGreaterThan(0); // 70 > 67
  });

  it('attempts proportional scaling for macro violations', async () => {
    const day = createTestDay(1, 2000, 0);
    day.macroTargets = { proteinG: 150, carbsG: 250, fatG: 67 };
    day.meals[0].nutrition = { kcal: 500, proteinG: 43, carbsG: 72, fatG: 19, fiberG: 3 };
    day.meals[1].nutrition = { kcal: 700, proteinG: 60, carbsG: 100, fatG: 27, fiberG: 5 };
    day.meals[2].nutrition = { kcal: 800, proteinG: 69, carbsG: 115, fatG: 31, fiberG: 6 };
    day.dailyTotals = {
      kcal: 2000,
      proteinG: 172, // +14.7% over 150g target
      carbsG: 287,
      fatG: 77,
      fiberG: 14,
    };

    const compiledPlan = createCompiledPlan([day]);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.adjustmentsMade.length).toBeGreaterThan(0);
  });

  it('returns no macroVariances when macroTargets absent', async () => {
    const day = createTestDay(1, 2000, 0);

    const compiledPlan = createCompiledPlan([day]);
    const compiledParsed = MealPlanCompiledSchema.parse(compiledPlan);
    const result = await validator.validate(compiledParsed);

    expect(result.qa.dayResults[0].macroVariances).toBeUndefined();
  });
});
