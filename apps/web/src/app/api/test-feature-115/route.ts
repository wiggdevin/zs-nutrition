import { NextResponse } from 'next/server';
import { MetabolicCalculator } from '@zero-sum/nutrition-engine';
import type { ClientIntake } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #115: Agent 2 calculates training day bonus
 * Verifies:
 * 1. Sedentary activity = 150 kcal bonus
 * 2. Extremely active = 300 kcal bonus
 * 3. restDayKcal equals goalKcal
 * 4. trainingDayKcal equals goalKcal + bonus
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const calculator = new MetabolicCalculator();
  const results = [];

  // Test Case 1: Sedentary activity (150 kcal bonus)
  const sedentaryIntake: ClientIntake = {
    name: 'Feature115_Sedentary',
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'sedentary',
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: ['italian'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    macroStyle: 'balanced',
    planDurationDays: 7,
  };

  const sedentaryResult = calculator.calculate(sedentaryIntake);

  // Test Case 2: Extremely active (300 kcal bonus)
  const activeIntake: ClientIntake = {
    ...sedentaryIntake,
    name: 'Feature115_ExtremelyActive',
    activityLevel: 'extremely_active',
  };

  const activeResult = calculator.calculate(activeIntake);

  // Verify Test Case 1: Sedentary
  const sedentaryChecks = {
    step1_sedentaryBonus: {
      description: 'Step 1: Sedentary activity = 150 kcal bonus',
      expected: 150,
      actual: sedentaryResult.trainingDayBonusKcal,
      pass: sedentaryResult.trainingDayBonusKcal === 150,
    },
    step3_restDayKcal_eq_goalKcal: {
      description: 'Step 3: restDayKcal equals goalKcal',
      expected: sedentaryResult.goalKcal,
      actual: sedentaryResult.restDayKcal,
      pass: sedentaryResult.restDayKcal === sedentaryResult.goalKcal,
    },
    step4_trainingDayKcal_eq_goalPlusBonus: {
      description: 'Step 4: trainingDayKcal equals goalKcal + bonus',
      expected: sedentaryResult.goalKcal + 150,
      actual: sedentaryResult.trainingDayKcal,
      pass: sedentaryResult.trainingDayKcal === sedentaryResult.goalKcal + 150,
    },
  };

  const sedentaryPassing = Object.values(sedentaryChecks).every(c => c.pass);

  // Verify Test Case 2: Extremely Active
  const activeChecks = {
    step2_extremelyActiveBonus: {
      description: 'Step 2: Extremely active = 300 kcal bonus',
      expected: 300,
      actual: activeResult.trainingDayBonusKcal,
      pass: activeResult.trainingDayBonusKcal === 300,
    },
    step3_restDayKcal_eq_goalKcal: {
      description: 'Step 3: restDayKcal equals goalKcal',
      expected: activeResult.goalKcal,
      actual: activeResult.restDayKcal,
      pass: activeResult.restDayKcal === activeResult.goalKcal,
    },
    step4_trainingDayKcal_eq_goalPlusBonus: {
      description: 'Step 4: trainingDayKcal equals goalKcal + bonus',
      expected: activeResult.goalKcal + 300,
      actual: activeResult.trainingDayKcal,
      pass: activeResult.trainingDayKcal === activeResult.goalKcal + 300,
    },
  };

  const activePassing = Object.values(activeChecks).every(c => c.pass);

  const allPassing = sedentaryPassing && activePassing;

  return NextResponse.json({
    feature: 'Feature #115: Agent 2 calculates training day bonus',
    featureId: 115,
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testResults: [
      {
        testCase: 'Sedentary Activity Level',
        input: { activityLevel: 'sedentary' },
        result: sedentaryResult,
        checks: sedentaryChecks,
        allPassing: sedentaryPassing,
      },
      {
        testCase: 'Extremely Active Activity Level',
        input: { activityLevel: 'extremely_active' },
        result: activeResult,
        checks: activeChecks,
        allPassing: activePassing,
      },
    ],
    summary: {
      totalChecks: 6,
      passingChecks: Object.values(sedentaryChecks).filter(c => c.pass).length + Object.values(activeChecks).filter(c => c.pass).length,
      allPassing,
    },
  });
}
