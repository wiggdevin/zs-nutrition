import { NextResponse } from 'next/server';
import { MetabolicCalculator } from '@zero-sum/nutrition-engine';
import type { ClientIntake } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #116: Agent 2 per-meal distribution
 * Tests that calories are correctly distributed across meals based on mealsPerDay setting
 */
export async function GET() {
  const calculator = new MetabolicCalculator();

  // Helper to create intake with specific meal/snack configuration
  function makeIntake(mealsPerDay: number, snacksPerDay: number, goalKcal = 2400): ClientIntake {
    // Calculate weight to achieve exactly goalKcal for maintenance
    const bmr = goalKcal / 1.2; // sedentary multiplier
    const weightKg = (bmr - 966.25) / 10; // Derived from Mifflin-St Jeor for male, 30yo, 177.8cm

    return {
      name: 'Feature116Test',
      sex: 'male',
      age: 30,
      heightCm: 177.8,
      weightKg: Math.round(weightKg * 1000) / 1000,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'sedentary',
      trainingDays: ['monday', 'wednesday', 'friday'],
      trainingTime: 'morning',
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american'],
      mealsPerDay,
      snacksPerDay,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'balanced',
      planDurationDays: 7,
    };
  }

  const results: any[] = [];

  // ============================================================================
  // Test 1: 3 meals, 0 snacks, goalKcal=2400
  // Expected: breakfast=600 (25%), lunch=840 (35%), dinner=960 (40%)
  // ============================================================================
  try {
    const intake1 = makeIntake(3, 0, 2400);
    const result1 = calculator.calculate(intake1);

    const test1Checks = {
      breakfastKcal: {
        expected: 600,
        actual: result1.mealTargets.find(m => m.slot === 'meal_1')?.kcal,
        pass: result1.mealTargets.find(m => m.slot === 'meal_1')?.kcal === 600,
      },
      breakfastPercent: {
        expected: 25,
        actual: result1.mealTargets.find(m => m.slot === 'meal_1')?.percentOfDaily,
        pass: result1.mealTargets.find(m => m.slot === 'meal_1')?.percentOfDaily === 25,
      },
      lunchKcal: {
        expected: 840,
        actual: result1.mealTargets.find(m => m.slot === 'meal_2')?.kcal,
        pass: result1.mealTargets.find(m => m.slot === 'meal_2')?.kcal === 840,
      },
      lunchPercent: {
        expected: 35,
        actual: result1.mealTargets.find(m => m.slot === 'meal_2')?.percentOfDaily,
        pass: result1.mealTargets.find(m => m.slot === 'meal_2')?.percentOfDaily === 35,
      },
      dinnerKcal: {
        expected: 960,
        actual: result1.mealTargets.find(m => m.slot === 'meal_3')?.kcal,
        pass: result1.mealTargets.find(m => m.slot === 'meal_3')?.kcal === 960,
      },
      dinnerPercent: {
        expected: 40,
        actual: result1.mealTargets.find(m => m.slot === 'meal_3')?.percentOfDaily,
        pass: result1.mealTargets.find(m => m.slot === 'meal_3')?.percentOfDaily === 40,
      },
      totalKcal: {
        expected: 2400,
        actual: result1.mealTargets.reduce((sum, m) => sum + m.kcal, 0),
        pass: result1.mealTargets.reduce((sum, m) => sum + m.kcal, 0) === 2400,
      },
    };

    results.push({
      testName: 'Test 1: 3 meals, 0 snacks, goalKcal=2400',
      input: { mealsPerDay: 3, snacksPerDay: 0, goalKcal: 2400 },
      checks: test1Checks,
      mealTargets: result1.mealTargets,
      pass: Object.values(test1Checks).every(c => c.pass),
    });
  } catch (error: any) {
    results.push({
      testName: 'Test 1: 3 meals, 0 snacks, goalKcal=2400',
      error: error.message,
      pass: false,
    });
  }

  // ============================================================================
  // Test 2: 4 meals, 1 snack (verify meal percentages adjust with snack deduction)
  // Base 4-meal distribution: [20%, 30%, 35%, 15%]
  // With 1 snack taking 10%, meals are scaled by 0.9
  // Expected: breakfast=432 (18%), lunch=648 (27%), dinner=756 (31.5%→32%), evening_snack=324 (13.5%→14%), snack=240 (10%)
  // ============================================================================
  try {
    const intake2 = makeIntake(4, 1, 2400);
    const result2 = calculator.calculate(intake2);

    const snackTotal = intake2.snacksPerDay * 0.1;
    const mealScale = 1 - snackTotal;

    const test2Checks = {
      snackKcal: {
        expected: 240,
        actual: result2.mealTargets.find(m => m.slot === 'snack_1')?.kcal,
        pass: result2.mealTargets.find(m => m.slot === 'snack_1')?.kcal === 240,
      },
      snackPercent: {
        expected: 10,
        actual: result2.mealTargets.find(m => m.slot === 'snack_1')?.percentOfDaily,
        pass: result2.mealTargets.find(m => m.slot === 'snack_1')?.percentOfDaily === 10,
      },
      breakfastScaled: {
        expected: Math.round(2400 * 0.20 * mealScale),
        actual: result2.mealTargets.find(m => m.slot === 'meal_1')?.kcal,
        pass: result2.mealTargets.find(m => m.slot === 'meal_1')?.kcal === Math.round(2400 * 0.20 * mealScale),
      },
      lunchScaled: {
        expected: Math.round(2400 * 0.30 * mealScale),
        actual: result2.mealTargets.find(m => m.slot === 'meal_2')?.kcal,
        pass: result2.mealTargets.find(m => m.slot === 'meal_2')?.kcal === Math.round(2400 * 0.30 * mealScale),
      },
      totalKcal: {
        expected: 2400,
        actual: result2.mealTargets.reduce((sum, m) => sum + m.kcal, 0),
        pass: Math.abs(result2.mealTargets.reduce((sum, m) => sum + m.kcal, 0) - 2400) <= 1, // Allow ±1 rounding
      },
    };

    results.push({
      testName: 'Test 2: 4 meals, 1 snack (verify snack deduction)',
      input: { mealsPerDay: 4, snacksPerDay: 1, goalKcal: 2400 },
      checks: test2Checks,
      mealTargets: result2.mealTargets,
      pass: Object.values(test2Checks).every(c => c.pass),
    });
  } catch (error: any) {
    results.push({
      testName: 'Test 2: 4 meals, 1 snack',
      error: error.message,
      pass: false,
    });
  }

  // ============================================================================
  // Test 3: Verify all meal targets sum to goalKcal (various configurations)
  // ============================================================================
  const testConfigs = [
    { meals: 2, snacks: 0, kcal: 2000 },
    { meals: 2, snacks: 1, kcal: 2000 },
    { meals: 3, snacks: 0, kcal: 2400 },
    { meals: 3, snacks: 1, kcal: 2400 },
    { meals: 3, snacks: 2, kcal: 2400 },
    { meals: 4, snacks: 0, kcal: 2500 },
    { meals: 4, snacks: 1, kcal: 2500 },
    { meals: 4, snacks: 2, kcal: 2500 },
    { meals: 5, snacks: 0, kcal: 3000 },
    { meals: 5, snacks: 1, kcal: 3000 },
    { meals: 6, snacks: 0, kcal: 3000 },
    { meals: 6, snacks: 2, kcal: 3000 },
  ];

  const test3Results: any[] = [];
  let test3Pass = true;

  for (const config of testConfigs) {
    try {
      const intake = makeIntake(config.meals, config.snacks, config.kcal);
      const result = calculator.calculate(intake);
      const totalKcal = result.mealTargets.reduce((sum, m) => sum + m.kcal, 0);
      const matches = Math.abs(totalKcal - result.goalKcal) <= 1; // Allow ±1 rounding

      test3Results.push({
        config,
        totalKcal,
        expectedKcal: result.goalKcal,
        matches,
      });

      if (!matches) test3Pass = false;
    } catch (error: any) {
      test3Results.push({
        config,
        error: error.message,
        matches: false,
      });
      test3Pass = false;
    }
  }

  results.push({
    testName: 'Test 3: Verify all meal targets sum to goalKcal',
    checks: {
      allConfigsSumCorrectly: {
        pass: test3Pass,
        details: test3Results,
      },
    },
    pass: test3Pass,
  });

  // ============================================================================
  // Test 4: Verify macro distribution across meals
  // ============================================================================
  try {
    const intake4 = makeIntake(3, 0, 2400);
    const result4 = calculator.calculate(intake4);

    const totalProtein = result4.mealTargets.reduce((sum, m) => sum + m.proteinG, 0);
    const totalCarbs = result4.mealTargets.reduce((sum, m) => sum + m.carbsG, 0);
    const totalFat = result4.mealTargets.reduce((sum, m) => sum + m.fatG, 0);

    const test4Checks = {
      proteinSum: {
        expected: result4.proteinTargetG,
        actual: totalProtein,
        pass: Math.abs(totalProtein - result4.proteinTargetG) <= 2, // Allow ±2g rounding
      },
      carbsSum: {
        expected: result4.carbsTargetG,
        actual: totalCarbs,
        pass: Math.abs(totalCarbs - result4.carbsTargetG) <= 2,
      },
      fatSum: {
        expected: result4.fatTargetG,
        actual: totalFat,
        pass: Math.abs(totalFat - result4.fatTargetG) <= 2,
      },
    };

    results.push({
      testName: 'Test 4: Verify macro distribution across meals',
      input: { mealsPerDay: 3, snacksPerDay: 0, goalKcal: 2400 },
      dailyTargets: {
        protein: result4.proteinTargetG,
        carbs: result4.carbsTargetG,
        fat: result4.fatTargetG,
      },
      mealMacroTotals: {
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
      },
      checks: test4Checks,
      pass: Object.values(test4Checks).every(c => c.pass),
    });
  } catch (error: any) {
    results.push({
      testName: 'Test 4: Macro distribution',
      error: error.message,
      pass: false,
    });
  }

  // ============================================================================
  // Test 5: Edge case - multiple snacks
  // ============================================================================
  try {
    const intake5 = makeIntake(3, 3, 2400);
    const result5 = calculator.calculate(intake5);

    const snackCount = result5.mealTargets.filter(m => m.slot.startsWith('snack_')).length;
    const mealCount = result5.mealTargets.filter(m => m.slot.startsWith('meal_')).length;

    // All snacks should be 10% each
    const allSnacksTenPercent = result5.mealTargets
      .filter(m => m.slot.startsWith('snack_'))
      .every(m => m.percentOfDaily === 10);

    const test5Checks = {
      correctMealCount: {
        expected: 3,
        actual: mealCount,
        pass: mealCount === 3,
      },
      correctSnackCount: {
        expected: 3,
        actual: snackCount,
        pass: snackCount === 3,
      },
      allSnacksTenPercent: {
        pass: allSnacksTenPercent,
      },
      totalKcal: {
        expected: 2400,
        actual: result5.mealTargets.reduce((sum, m) => sum + m.kcal, 0),
        pass: result5.mealTargets.reduce((sum, m) => sum + m.kcal, 0) === 2400,
      },
    };

    results.push({
      testName: 'Test 5: Edge case - 3 meals, 3 snacks',
      input: { mealsPerDay: 3, snacksPerDay: 3, goalKcal: 2400 },
      checks: test5Checks,
      pass: Object.values(test5Checks).every(c => c.pass),
    });
  } catch (error: any) {
    results.push({
      testName: 'Test 5: Multiple snacks',
      error: error.message,
      pass: false,
    });
  }

  const allPassing = results.every(r => r.pass);

  return NextResponse.json({
    feature: 'Feature #116: Agent 2 calculates per-meal distribution',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount: results.filter(r => r.pass).length,
    results,
  });
}
