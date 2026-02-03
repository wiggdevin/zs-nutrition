import { NextResponse } from 'next/server';
import { QAValidator } from '@zero-sum/nutrition-engine';
import type { MealPlanCompiled, CompiledDay, CompiledMeal } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #121: Agent 5 QA Validator verification
 *
 * Test cases:
 * 1. Plan within ±3% kcal tolerance → QA status is PASS
 * 2. Plan with 5% kcal variance → QA flags the day
 * 3. Optimization iteration is triggered when out of tolerance
 */
export async function GET() {
  const validator = new QAValidator();
  const results: any[] = [];

  // =============================================
  // Helper: create a compiled meal
  // =============================================
  function makeMeal(
    slot: string,
    name: string,
    kcal: number,
    proteinG: number,
    carbsG: number,
    fatG: number
  ): CompiledMeal {
    return {
      slot,
      name,
      cuisine: 'american',
      prepTimeMin: 10,
      cookTimeMin: 15,
      servings: 1,
      nutrition: { kcal, proteinG, carbsG, fatG },
      confidenceLevel: 'verified',
      ingredients: [
        { name: 'Chicken Breast', amount: 170, unit: 'g' },
        { name: 'Brown Rice, Cooked', amount: 150, unit: 'g' },
        { name: 'Olive Oil', amount: 1, unit: 'tbsp' },
        { name: 'Salt and Pepper', amount: 1, unit: 'to taste' },
      ],
      instructions: ['Prep ingredients.', 'Cook chicken.', 'Serve with rice.'],
      primaryProtein: 'chicken',
      tags: ['high-protein'],
    };
  }

  // =============================================
  // Helper: create a compiled day
  // =============================================
  function makeDay(
    dayNumber: number,
    dayName: string,
    isTrainingDay: boolean,
    targetKcal: number,
    meals: CompiledMeal[]
  ): CompiledDay {
    let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0;
    for (const m of meals) {
      totalKcal += m.nutrition.kcal;
      totalP += m.nutrition.proteinG;
      totalC += m.nutrition.carbsG;
      totalF += m.nutrition.fatG;
    }
    const varianceKcal = totalKcal - targetKcal;
    const variancePercent = targetKcal > 0
      ? Math.round((varianceKcal / targetKcal) * 10000) / 100
      : 0;
    return {
      dayNumber,
      dayName,
      isTrainingDay,
      targetKcal,
      meals,
      dailyTotals: {
        kcal: Math.round(totalKcal),
        proteinG: Math.round(totalP * 10) / 10,
        carbsG: Math.round(totalC * 10) / 10,
        fatG: Math.round(totalF * 10) / 10,
      },
      varianceKcal: Math.round(varianceKcal),
      variancePercent,
    };
  }

  // =============================================
  // TEST CASE 1: Plan within tolerances → PASS
  // Target: 2000 kcal/day, meals sum to ~2000 (within ±3%)
  // =============================================
  try {
    const targetKcal = 2000;
    // Meals sum exactly to 2000 (0% variance)
    const withinDays: CompiledDay[] = [
      makeDay(1, 'Monday', true, targetKcal, [
        makeMeal('breakfast', 'Egg Scramble', 500, 35, 30, 22),
        makeMeal('lunch', 'Chicken Rice Bowl', 700, 45, 60, 18),
        makeMeal('dinner', 'Salmon with Quinoa', 650, 40, 50, 20),
        makeMeal('snack_1', 'Greek Yogurt', 150, 15, 12, 5),
      ]),
      makeDay(2, 'Tuesday', false, targetKcal, [
        makeMeal('breakfast', 'Oatmeal Bowl', 480, 20, 60, 12),
        makeMeal('lunch', 'Turkey Wrap', 720, 42, 55, 20),
        makeMeal('dinner', 'Beef Stir Fry', 640, 38, 52, 18),
        makeMeal('snack_1', 'Protein Shake', 160, 25, 8, 4),
      ]),
    ];

    const withinPlan: MealPlanCompiled = {
      days: withinDays,
      weeklyAverages: { kcal: 2000, proteinG: 140, carbsG: 165, fatG: 60 },
    };

    const result1 = await validator.validate(withinPlan);

    const test1Checks = {
      qaStatusIsPASS: {
        expected: 'PASS',
        actual: result1.qa.status,
        pass: result1.qa.status === 'PASS',
      },
      scoreAbove90: {
        expected: '>= 90',
        actual: result1.qa.score,
        pass: result1.qa.score >= 90,
      },
      allDaysPASS: {
        expected: true,
        actual: result1.qa.dayResults.every((d) => d.status === 'PASS'),
        pass: result1.qa.dayResults.every((d) => d.status === 'PASS'),
      },
      dayResultsCount: {
        expected: 2,
        actual: result1.qa.dayResults.length,
        pass: result1.qa.dayResults.length === 2,
      },
      hasGroceryList: {
        expected: true,
        actual: result1.groceryList.length > 0,
        pass: result1.groceryList.length > 0,
      },
      hasWeeklyTotals: {
        expected: true,
        actual: result1.weeklyTotals.avgKcal > 0,
        pass: result1.weeklyTotals.avgKcal > 0,
      },
      hasGeneratedAt: {
        expected: true,
        actual: !!result1.generatedAt,
        pass: !!result1.generatedAt,
      },
      hasEngineVersion: {
        expected: '2.0.0',
        actual: result1.engineVersion,
        pass: result1.engineVersion === '2.0.0',
      },
    };

    results.push({
      testCase: 1,
      name: 'Plan within tolerances → PASS',
      checks: test1Checks,
      allPassing: Object.values(test1Checks).every((c) => c.pass),
      qaResult: result1.qa,
      groceryCategories: result1.groceryList.map((g) => g.category),
      weeklyTotals: result1.weeklyTotals,
    });
  } catch (error: any) {
    results.push({
      testCase: 1,
      name: 'Plan within tolerances → PASS',
      error: error.message,
      allPassing: false,
    });
  }

  // =============================================
  // TEST CASE 2: Plan with 5% kcal variance → flags the day
  // Target: 2000 kcal/day, but day 1 has 2100 kcal (5% over)
  // =============================================
  try {
    const targetKcal = 2000;
    // Day 1: 2100 kcal = 5% over target (exceeds ±3% tolerance)
    // Day 2: 2000 kcal = exactly on target
    const overDays: CompiledDay[] = [
      makeDay(1, 'Monday', true, targetKcal, [
        makeMeal('breakfast', 'Big Egg Scramble', 550, 38, 35, 25),
        makeMeal('lunch', 'Chicken Rice Bowl XL', 750, 48, 65, 20),
        makeMeal('dinner', 'Steak Dinner', 650, 42, 45, 22),
        makeMeal('snack_1', 'Trail Mix', 150, 6, 15, 10),
      ]), // Total: 2100 kcal, variancePercent: +5%
      makeDay(2, 'Tuesday', false, targetKcal, [
        makeMeal('breakfast', 'Oatmeal', 500, 20, 60, 12),
        makeMeal('lunch', 'Turkey Wrap', 700, 42, 55, 18),
        makeMeal('dinner', 'Cod with Veggies', 650, 38, 55, 16),
        makeMeal('snack_1', 'Fruit Cup', 150, 2, 35, 1),
      ]), // Total: 2000 kcal, variancePercent: 0%
    ];

    const overPlan: MealPlanCompiled = {
      days: overDays,
      weeklyAverages: { kcal: 2050, proteinG: 118, carbsG: 165, fatG: 62 },
    };

    const result2 = await validator.validate(overPlan);

    // After optimization, the day should be adjusted closer to target
    // The 5% variance should be flagged initially
    const day1Result = result2.qa.dayResults.find((d) => d.dayNumber === 1);
    const day2Result = result2.qa.dayResults.find((d) => d.dayNumber === 2);

    const test2Checks = {
      day1WasFlagged: {
        description: 'Day 1 with 5% variance was detected and optimization attempted',
        expected: true,
        actual: result2.qa.iterations >= 1,
        pass: result2.qa.iterations >= 1,
      },
      day1VarianceReduced: {
        description: 'After optimization, day 1 variance should be reduced',
        expected: '< 5%',
        actual: day1Result ? Math.abs(day1Result.variancePercent) : 'N/A',
        pass: day1Result ? Math.abs(day1Result.variancePercent) < 5 : false,
      },
      day2StillPASS: {
        description: 'Day 2 (already within tolerance) stays PASS',
        expected: 'PASS',
        actual: day2Result?.status,
        pass: day2Result?.status === 'PASS',
      },
      adjustmentsMadeForDay1: {
        description: 'Optimization made at least one adjustment',
        expected: '>= 1',
        actual: result2.qa.adjustmentsMade.length,
        pass: result2.qa.adjustmentsMade.length >= 1,
      },
      scoreReasonable: {
        description: 'QA score should be > 0 (plan is partially good)',
        expected: '> 0',
        actual: result2.qa.score,
        pass: result2.qa.score > 0,
      },
    };

    results.push({
      testCase: 2,
      name: 'Plan with 5% kcal variance → flags the day',
      checks: test2Checks,
      allPassing: Object.values(test2Checks).every((c) => c.pass),
      qaResult: result2.qa,
    });
  } catch (error: any) {
    results.push({
      testCase: 2,
      name: 'Plan with 5% kcal variance → flags the day',
      error: error.message,
      allPassing: false,
    });
  }

  // =============================================
  // TEST CASE 3: Optimization iteration is triggered
  // Target: 2000 kcal/day, day has 2080 kcal (4% over, just above 3% threshold)
  // After optimization, should be brought within tolerance
  // =============================================
  try {
    const targetKcal = 2000;
    // Day 1: 2080 kcal = 4% over (triggers optimization since > 3%)
    const optimizeDays: CompiledDay[] = [
      makeDay(1, 'Monday', true, targetKcal, [
        makeMeal('breakfast', 'Omelette', 520, 36, 20, 25),
        makeMeal('lunch', 'Grilled Chicken Salad', 680, 45, 30, 22),
        makeMeal('dinner', 'Pasta Bolognese', 720, 35, 70, 20),
        makeMeal('snack_1', 'Protein Bar', 160, 20, 18, 6),
      ]), // Total: 2080 kcal, variancePercent: +4%
    ];

    const optimizePlan: MealPlanCompiled = {
      days: optimizeDays,
      weeklyAverages: { kcal: 2080, proteinG: 136, carbsG: 138, fatG: 73 },
    };

    const result3 = await validator.validate(optimizePlan);

    const day1After = result3.qa.dayResults.find((d) => d.dayNumber === 1);

    const test3Checks = {
      iterationsRan: {
        description: 'At least 1 optimization iteration ran',
        expected: '>= 1',
        actual: result3.qa.iterations,
        pass: result3.qa.iterations >= 1,
      },
      adjustmentMade: {
        description: 'An adjustment was made to bring day within tolerance',
        expected: '>= 1 adjustment',
        actual: result3.qa.adjustmentsMade.length,
        pass: result3.qa.adjustmentsMade.length >= 1,
      },
      day1OptimizedCloserToTarget: {
        description: 'Day 1 variance should be reduced after optimization',
        expected: '<= 3% (within tolerance)',
        actual: day1After ? `${Math.abs(day1After.variancePercent).toFixed(2)}%` : 'N/A',
        pass: day1After ? Math.abs(day1After.variancePercent) <= 3 : false,
      },
      day1StatusAfterOptimization: {
        description: 'Day 1 status should be PASS after successful optimization',
        expected: 'PASS',
        actual: day1After?.status,
        pass: day1After?.status === 'PASS',
      },
      overallStatusAfterOptimization: {
        description: 'Overall QA status should be PASS after optimization fixes it',
        expected: 'PASS',
        actual: result3.qa.status,
        pass: result3.qa.status === 'PASS',
      },
      adjustmentDescriptionMentionsDay: {
        description: 'Adjustment description mentions Day 1',
        expected: 'contains "Day 1"',
        actual: result3.qa.adjustmentsMade[0] || 'none',
        pass: result3.qa.adjustmentsMade.length > 0 && result3.qa.adjustmentsMade[0].includes('Day 1'),
      },
    };

    results.push({
      testCase: 3,
      name: 'Optimization iteration is triggered',
      checks: test3Checks,
      allPassing: Object.values(test3Checks).every((c) => c.pass),
      qaResult: result3.qa,
    });
  } catch (error: any) {
    results.push({
      testCase: 3,
      name: 'Optimization iteration is triggered',
      error: error.message,
      allPassing: false,
    });
  }

  const allPassing = results.every((r) => r.allPassing);

  return NextResponse.json({
    feature: 'Feature #121: Agent 5 QA validation enforces tolerances',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount: results.filter((r) => r.allPassing).length,
    results,
  });
}
