import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DEV API: Seed test user for feature #191 testing
 * POST /api/dev-test/seed-191
 */
export async function POST(request: Request) {
  // Only allow in dev mode
  const isDevMode =
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === "sk_test_placeholder" ||
    process.env.CLERK_SECRET_KEY === "";

  if (!isDevMode) {
    return NextResponse.json(
      { error: "Dev test endpoint only available in development mode" },
      { status: 403 }
    );
  }

  try {
    const testEmail = 'feature-191-test@zsmac.dev';
    const clerkUserId = 'test_clerk_user_191';

    // Create user
    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: { isActive: true },
      create: {
        clerkUserId,
        email: testEmail,
        isActive: true,
      },
    });

    // Create profile
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.userProfile.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Feature 191 Test User',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']),
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        dietaryStyle: 'omnivore',
        allergies: JSON.stringify([]),
        exclusions: JSON.stringify([]),
        cuisinePrefs: JSON.stringify([]),
        bmrKcal: 2000,
        tdeeKcal: 2700,
        goalKcal: 2500,
        proteinTargetG: 150,
        carbsTargetG: 250,
        fatTargetG: 80,
        isActive: true,
      },
    });

    // Create onboarding
    await prisma.onboardingState.upsert({
      where: { userId: user.id },
      update: { completed: true },
      create: {
        userId: user.id,
        currentStep: 6,
        completed: true,
      },
    });

    // Create daily log
    const dailyLog = await prisma.dailyLog.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
      update: {},
      create: {
        userId: user.id,
        date: today,
        targetKcal: 2700,
        targetProteinG: 150,
        targetCarbsG: 250,
        targetFatG: 80,
        actualKcal: 1500,
        actualProteinG: 115,
        actualCarbsG: 110,
        actualFatG: 50,
        adherenceScore: 0,
      },
    });

    // Delete existing tracked meals for today
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        loggedDate: today,
      },
    });

    // Create tracked meals with different confidence scores
    await prisma.trackedMeal.createMany({
      data: [
        {
          userId: user.id,
          loggedDate: today,
          mealSlot: 'lunch',
          mealName: '🟢 FatSecret Grilled Chicken Breast',
          portion: 1.0,
          kcal: 300,
          proteinG: 50,
          carbsG: 0,
          fatG: 5,
          fiberG: 0,
          source: 'fatsecret_search',
          confidenceScore: 1.0,
        },
        {
          userId: user.id,
          loggedDate: today,
          mealSlot: 'breakfast',
          mealName: '🟢 Plan Meal: Verified Oatmeal Bowl',
          portion: 1.0,
          kcal: 500,
          proteinG: 20,
          carbsG: 70,
          fatG: 15,
          fiberG: 0,
          source: 'plan_meal',
          confidenceScore: 1.0,
        },
        {
          userId: user.id,
          loggedDate: today,
          mealSlot: 'dinner',
          mealName: '🟠 Plan Meal: AI-Estimated Chicken Salad',
          portion: 1.0,
          kcal: 700,
          proteinG: 45,
          carbsG: 40,
          fatG: 30,
          fiberG: 0,
          source: 'plan_meal',
          confidenceScore: 0.7,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        id: user.id,
        email: user.email,
        clerkUserId: user.clerkUserId,
      },
      trackedMeals: [
        { name: '🟢 FatSecret Grilled Chicken Breast', source: 'fatsecret_search', confidenceScore: 1.0, expectedBadge: 'Verified (green)' },
        { name: '🟢 Plan Meal: Verified Oatmeal Bowl', source: 'plan_meal', confidenceScore: 1.0, expectedBadge: 'Verified (green)' },
        { name: '🟠 Plan Meal: AI-Estimated Chicken Salad', source: 'plan_meal', confidenceScore: 0.7, expectedBadge: 'AI-Estimated (amber)' },
      ],
    });
  } catch (error: any) {
    console.error('Error seeding test user:', error);
    return NextResponse.json(
      { error: 'Failed to seed test user', details: error.message },
      { status: 500 }
    );
  }
}
