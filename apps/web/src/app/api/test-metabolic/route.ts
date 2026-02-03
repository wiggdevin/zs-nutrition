import { NextResponse } from 'next/server';
import { MetabolicCalculator } from '@zero-sum/nutrition-engine';
import type { ClientIntake } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #91: Agent 2 Metabolic Calculator verification
 * Runs known test cases and compares actual vs expected values.
 */
export async function GET() {
  const calculator = new MetabolicCalculator();

  // Test Case 1: Male, 30yo, 180cm, 80kg, moderately_active, cut @1lb/wk, balanced, 3 meals, 1 snack
  const testIntake: ClientIntake = {
    name: 'TestUser_Agent2',
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goalType: 'cut',
    goalRate: 1,
    activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: ['italian', 'asian'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 7,
    prepTimeMaxMin: 45,
    macroStyle: 'balanced',
    planDurationDays: 7,
  };

  // Test Case 2: Female, 25yo, 165cm, 60kg, lightly_active, maintain, high_protein, 4 meals, 0 snacks
  const testIntake2: ClientIntake = {
    name: 'TestUser_Agent2_Female',
    sex: 'female',
    age: 25,
    heightCm: 165,
    weightKg: 60,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'lightly_active',
    trainingDays: ['tuesday', 'thursday'],
    trainingTime: 'evening',
    dietaryStyle: 'vegetarian',
    allergies: ['peanuts'],
    exclusions: [],
    cuisinePreferences: ['mediterranean'],
    mealsPerDay: 4,
    snacksPerDay: 0,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    macroStyle: 'high_protein',
    planDurationDays: 7,
  };

  // Test Case 3: Male, bulk, keto macros
  const testIntake3: ClientIntake = {
    name: 'TestUser_Agent2_Bulk',
    sex: 'male',
    age: 22,
    heightCm: 175,
    weightKg: 70,
    goalType: 'bulk',
    goalRate: 1,
    activityLevel: 'very_active',
    trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    trainingTime: 'afternoon',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: [],
    mealsPerDay: 5,
    snacksPerDay: 2,
    cookingSkill: 8,
    prepTimeMaxMin: 60,
    macroStyle: 'keto',
    planDurationDays: 7,
  };

  const results: any[] = [];

  for (const [idx, intake] of [testIntake, testIntake2, testIntake3].entries()) {
    try {
      const result = calculator.calculate(intake);

      // Manual calculations for verification
      let expectedBmr: number;
      if (intake.sex === 'male') {
        expectedBmr = Math.round(10 * intake.weightKg + 6.25 * intake.heightCm - 5 * intake.age + 5);
      } else {
        expectedBmr = Math.round(10 * intake.weightKg + 6.25 * intake.heightCm - 5 * intake.age - 161);
      }

      const activityMultipliers: Record<string, number> = {
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
        extremely_active: 1.9,
      };
      const expectedTdee = Math.round(expectedBmr * activityMultipliers[intake.activityLevel]);

      let expectedGoalKcal: number;
      if (intake.goalType === 'cut') {
        expectedGoalKcal = Math.round(expectedTdee - intake.goalRate * 500);
      } else if (intake.goalType === 'bulk') {
        expectedGoalKcal = Math.round(expectedTdee + intake.goalRate * 350);
      } else {
        expectedGoalKcal = expectedTdee;
      }

      const macroSplits: Record<string, { protein: number; carbs: number; fat: number }> = {
        balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
        high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
        low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
        keto: { protein: 0.3, carbs: 0.05, fat: 0.65 },
      };
      const split = macroSplits[intake.macroStyle];
      const expectedProtein = Math.round((expectedGoalKcal * split.protein) / 4);
      const expectedCarbs = Math.round((expectedGoalKcal * split.carbs) / 4);
      const expectedFat = Math.round((expectedGoalKcal * split.fat) / 9);
      const expectedFiber = Math.max(25, Math.round((expectedGoalKcal / 1000) * 14));

      const bonusMap: Record<string, number> = {
        sedentary: 150,
        lightly_active: 175,
        moderately_active: 200,
        very_active: 250,
        extremely_active: 300,
      };
      const expectedBonus = bonusMap[intake.activityLevel] ?? 200;
      const expectedTrainingDayKcal = expectedGoalKcal + expectedBonus;

      const checks = {
        bmr: { expected: expectedBmr, actual: result.bmrKcal, pass: result.bmrKcal === expectedBmr },
        tdee: { expected: expectedTdee, actual: result.tdeeKcal, pass: result.tdeeKcal === expectedTdee },
        goalKcal: { expected: expectedGoalKcal, actual: result.goalKcal, pass: result.goalKcal === expectedGoalKcal },
        proteinTargetG: { expected: expectedProtein, actual: result.proteinTargetG, pass: result.proteinTargetG === expectedProtein },
        carbsTargetG: { expected: expectedCarbs, actual: result.carbsTargetG, pass: result.carbsTargetG === expectedCarbs },
        fatTargetG: { expected: expectedFat, actual: result.fatTargetG, pass: result.fatTargetG === expectedFat },
        fiberTargetG: { expected: expectedFiber, actual: result.fiberTargetG, pass: result.fiberTargetG === expectedFiber },
        trainingDayBonus: { expected: expectedBonus, actual: result.trainingDayBonusKcal, pass: result.trainingDayBonusKcal === expectedBonus },
        restDayKcal: { expected: expectedGoalKcal, actual: result.restDayKcal, pass: result.restDayKcal === expectedGoalKcal },
        trainingDayKcal: { expected: expectedTrainingDayKcal, actual: result.trainingDayKcal, pass: result.trainingDayKcal === expectedTrainingDayKcal },
        calculationMethod: { expected: 'mifflin_st_jeor', actual: result.calculationMethod, pass: result.calculationMethod === 'mifflin_st_jeor' },
        macroSplitProtein: { expected: split.protein * 100, actual: result.macroSplit.proteinPercent, pass: result.macroSplit.proteinPercent === split.protein * 100 },
        macroSplitCarbs: { expected: split.carbs * 100, actual: result.macroSplit.carbsPercent, pass: result.macroSplit.carbsPercent === split.carbs * 100 },
        macroSplitFat: { expected: split.fat * 100, actual: result.macroSplit.fatPercent, pass: result.macroSplit.fatPercent === split.fat * 100 },
      };

      // Verify meal targets distributed correctly
      const totalMealPercent = result.mealTargets.reduce((s, m) => s + m.percentOfDaily, 0);
      const expectedMealCount = intake.mealsPerDay + intake.snacksPerDay;
      const mealTargetChecks = {
        mealSlotCount: { expected: expectedMealCount, actual: result.mealTargets.length, pass: result.mealTargets.length === expectedMealCount },
        totalPercentApprox100: { expected: '~100', actual: totalMealPercent, pass: totalMealPercent >= 90 && totalMealPercent <= 110 },
        allSlotsHaveKcal: { pass: result.mealTargets.every(m => m.kcal > 0) },
        allSlotsHaveProtein: { pass: result.mealTargets.every(m => m.proteinG > 0) },
        allSlotsHaveLabels: { pass: result.mealTargets.every(m => m.label.length > 0) },
      };

      const allChecksPassing = Object.values(checks).every(c => c.pass) && Object.values(mealTargetChecks).every(c => c.pass);

      results.push({
        testCase: idx + 1,
        name: intake.name,
        input: {
          sex: intake.sex,
          age: intake.age,
          heightCm: intake.heightCm,
          weightKg: intake.weightKg,
          activityLevel: intake.activityLevel,
          goalType: intake.goalType,
          goalRate: intake.goalRate,
          macroStyle: intake.macroStyle,
          mealsPerDay: intake.mealsPerDay,
          snacksPerDay: intake.snacksPerDay,
        },
        checks,
        mealTargetChecks,
        mealTargets: result.mealTargets,
        allPassing: allChecksPassing,
        schemaValidated: true, // If we got here, MetabolicProfileSchema.parse() succeeded
      });
    } catch (error: any) {
      results.push({
        testCase: idx + 1,
        name: [testIntake, testIntake2, testIntake3][idx].name,
        error: error.message,
        allPassing: false,
        schemaValidated: false,
      });
    }
  }

  const allPassing = results.every(r => r.allPassing);

  return NextResponse.json({
    feature: 'Feature #91: Agent 2 Metabolic Calculator works correctly',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount: results.filter(r => r.allPassing).length,
    results,
  });
}
