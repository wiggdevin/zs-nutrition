import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DEV TEST ENDPOINT - Creates a test user with a complete meal plan
 * GET /api/dev-test-user-plan
 *
 * Creates:
 * 1. User with clerkUserId "dev-test-user-plan@zsmac.dev"
 * 2. UserProfile with metabolic targets
 * 3. MealPlan with all metadata (QA score, date, targets)
 *
 * Returns the user email so you can sign in and view the meal plan.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const clerkUserId = 'dev-test-user-plan@zsmac.dev';
    const email = 'dev-test-user-plan@zsmac.dev';

    // Create or get user
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { clerkUserId, email },
      });
    }

    // Create or update profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    const profileData = {
      userId: user.id,
      name: 'Dev Test User',
      sex: 'male' as const,
      age: 30,
      heightCm: 177.8,
      weightKg: 81.6,
      goalType: 'cut' as const,
      goalRate: 1,
      activityLevel: 'moderately_active' as const,
      dietaryStyle: 'omnivore' as const,
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMax: 30,
      macroStyle: 'balanced' as const,
      trainingDays: 'monday,wednesday,friday',
      bmrKcal: 1800,
      tdeeKcal: 2790,
      goalKcal: 2290,
      proteinTargetG: 172,
      carbsTargetG: 229,
      fatTargetG: 76,
      isActive: true,
    };

    if (!profile) {
      profile = await prisma.userProfile.create({ data: profileData });
    } else {
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: profileData,
      });
    }

    // Complete onboarding
    await prisma.onboardingState.upsert({
      where: { userId: user.id },
      update: { completed: true, currentStep: 6 },
      create: {
        userId: user.id,
        currentStep: 6,
        completed: true,
        stepData: '{}',
      },
    });

    // Deactivate any existing meal plans
    await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, status: 'expired' },
    });

    // Create meal plan with full metadata for feature #165 testing
    const validatedPlan = {
      days: Array.from({ length: 7 }, (_, i) => ({
        dayNumber: i + 1,
        dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
        isTrainingDay: [1, 3, 5].includes(i + 1),
        targetKcal: 2290,
        meals: [
          {
            slot: 'breakfast',
            name: `Day ${i + 1} - Oatmeal Protein Bowl`,
            cuisine: 'american',
            prepTimeMin: 5,
            cookTimeMin: 5,
            nutrition: { kcal: 420, proteinG: 35, carbsG: 48, fatG: 12, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Oats', amount: '80g' },
              { name: 'Protein powder', amount: '1 scoop' },
            ],
            instructions: ['Mix and serve'],
          },
          {
            slot: 'lunch',
            name: `Day ${i + 1} - Chicken Rice Bowl`,
            cuisine: 'american',
            prepTimeMin: 10,
            cookTimeMin: 15,
            nutrition: { kcal: 600, proteinG: 50, carbsG: 55, fatG: 18, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [{ name: 'Chicken breast', amount: '200g' }],
            instructions: ['Cook and serve'],
          },
          {
            slot: 'dinner',
            name: `Day ${i + 1} - Salmon Sweet Potato`,
            cuisine: 'american',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: { kcal: 650, proteinG: 45, carbsG: 42, fatG: 30, fiberG: 7 },
            confidenceLevel: 'verified',
            ingredients: [{ name: 'Salmon', amount: '200g' }],
            instructions: ['Roast and serve'],
          },
          {
            slot: 'snack',
            name: `Day ${i + 1} - Protein Shake`,
            cuisine: 'american',
            prepTimeMin: 2,
            cookTimeMin: 0,
            nutrition: { kcal: 280, proteinG: 30, carbsG: 15, fatG: 10, fiberG: 2 },
            confidenceLevel: 'ai_estimated',
            ingredients: [{ name: 'Whey protein', amount: '1 scoop' }],
            instructions: ['Blend and serve'],
          },
        ],
      })),
      groceryList: [
        { category: 'Protein', items: [{ name: 'Chicken', amount: 1400, unit: 'g' }] },
      ],
      qa: { status: 'PASS', score: 88, iterations: 2 },
      weeklyTotals: { avgKcal: 1950, avgProteinG: 160, avgCarbsG: 160, avgFatG: 70 },
    };

    const metabolicProfile = {
      bmrKcal: 1800,
      tdeeKcal: 2790,
      goalKcal: 2290,
      proteinTargetG: 172,
      carbsTargetG: 229,
      fatTargetG: 76,
      trainingBonusKcal: 200,
    };

    // Create meal plan with all metadata for feature #165
    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify(validatedPlan),
        metabolicProfile: JSON.stringify(metabolicProfile),
        dailyKcalTarget: 2290,
        dailyProteinG: 172,
        dailyCarbsG: 229,
        dailyFatG: 76,
        trainingBonusKcal: 200,
        planDays: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qaScore: 88,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test user and meal plan created',
      email,
      clerkUserId,
      planId: plan.id,
      plan: {
        id: plan.id,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        generatedAt: plan.generatedAt,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
      },
      instructions: `Sign in with email: ${email}`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
      { status: 500 }
    );
  }
}
