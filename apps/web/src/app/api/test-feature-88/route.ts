import { NextResponse } from 'next/server';
import { MetabolicCalculator } from '@zero-sum/nutrition-engine';
import type { ClientIntake } from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #88: Meal distribution percentages
 *
 * POST /api/test-feature-88
 * Body: { mealsPerDay, snacksPerDay, goalKcal, proteinTargetG, carbsTargetG, fatTargetG }
 *
 * Returns metabolic profile with meal targets for testing distribution percentages
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { mealsPerDay, snacksPerDay, goalKcal, proteinTargetG, carbsTargetG, fatTargetG } = body;

    // Create minimal test intake
    const testIntake: ClientIntake = {
      name: 'TestUser_Feature88',
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: [],
      mealsPerDay,
      snacksPerDay,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'balanced',
      planDurationDays: 7,
    };

    const calculator = new MetabolicCalculator();
    const result = calculator.calculate(testIntake);

    // Extract distribution data
    const mealTargets = result.mealTargets;
    const mealOnly = mealTargets.filter(m =>
      m.label === 'breakfast' || m.label === 'lunch' || m.label === 'dinner'
    );
    const snackOnly = mealTargets.filter(m => m.label.includes('snack'));

    const mealPercentages = mealOnly.map(m => m.percentOfDaily);
    const snackPercentages = snackOnly.map(m => m.percentOfDaily);
    const totalPercentage = mealTargets.reduce((sum, m) => sum + m.percentOfDaily, 0);

    return NextResponse.json({
      input: {
        mealsPerDay,
        snacksPerDay,
      },
      metabolicProfile: result,
      distribution: {
        mealOnly: mealOnly.map(m => ({
          label: m.label,
          slot: m.slot,
          percentOfDaily: m.percentOfDaily,
          kcal: m.kcal,
        })),
        snackOnly: snackOnly.map(m => ({
          label: m.label,
          slot: m.slot,
          percentOfDaily: m.percentOfDaily,
          kcal: m.kcal,
        })),
        mealPercentages,
        snackPercentages,
        totalPercentage,
        slotCount: mealTargets.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
