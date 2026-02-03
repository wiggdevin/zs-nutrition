import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Inserting test plans for Feature #464...');

    // Get a user ID (first available user)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json(
        { error: "No users found. Please create a user first." },
        { status: 400 }
      );
    }

    // Get or create a profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Test User Feature 464',
          sex: 'male',
          age: 30,
          weightKg: 75,
          heightCm: 175,
          goalType: 'maintain',
          goalRate: 0,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          allergies: '[]',
          exclusions: '[]',
          trainingDays: '[]',
          mealsPerDay: 3,
          snacksPerDay: 1,
          cookingSkill: 5,
          prepTimeMax: 30,
          macroStyle: 'balanced',
        },
      });
    }

    const basePlan: any = {
      userId: user.id,
      profileId: profile.id,
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 70,
      trainingBonusKcal: 0,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      isActive: true,
      generatedAt: new Date(),
      metabolicProfile: JSON.stringify({
        bmrKcal: 1750,
        tdeeKcal: 2000,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 70,
      }),
    };

    // Test Plan 1: PASS status (green #22c55e)
    const passPlanValidated = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: false,
          targetKcal: 2000,
          meals: [
            {
              slot: 'Breakfast',
              name: 'Oatmeal with Berries (PASS TEST 464)',
              cuisine: 'American',
              prepTimeMin: 10,
              cookTimeMin: 5,
              nutrition: { kcal: 450, proteinG: 15, carbsG: 65, fatG: 12 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Lunch',
              name: 'Grilled Chicken Salad (PASS TEST 464)',
              cuisine: 'Mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 20,
              nutrition: { kcal: 550, proteinG: 45, carbsG: 30, fatG: 22 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Dinner',
              name: 'Salmon with Vegetables (PASS TEST 464)',
              cuisine: 'European',
              prepTimeMin: 10,
              cookTimeMin: 25,
              nutrition: { kcal: 600, proteinG: 50, carbsG: 25, fatG: 30 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Snack',
              name: 'Greek Yogurt (PASS TEST 464)',
              nutrition: { kcal: 200, proteinG: 20, carbsG: 15, fatG: 5 },
              confidenceLevel: 'verified',
            },
          ],
        },
      ],
      qa: { status: 'PASS', score: 92, iterations: 1 },
    };

    // Test Plan 2: WARN status (amber #f59e0b)
    const warnPlanValidated = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: false,
          targetKcal: 2000,
          meals: [
            {
              slot: 'Breakfast',
              name: 'Toast with Eggs (WARN TEST 464)',
              cuisine: 'American',
              prepTimeMin: 10,
              cookTimeMin: 5,
              nutrition: { kcal: 450, proteinG: 15, carbsG: 65, fatG: 12 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Lunch',
              name: 'Turkey Sandwich (WARN TEST 464)',
              cuisine: 'American',
              prepTimeMin: 10,
              nutrition: { kcal: 550, proteinG: 35, carbsG: 50, fatG: 18 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Dinner',
              name: 'Pasta with Meat Sauce (WARN TEST 464)',
              cuisine: 'Italian',
              prepTimeMin: 15,
              cookTimeMin: 30,
              nutrition: { kcal: 700, proteinG: 35, carbsG: 75, fatG: 25 },
              confidenceLevel: 'verified',
            },
            {
              slot: 'Snack',
              name: 'Apple with Peanut Butter (WARN TEST 464)',
              nutrition: { kcal: 200, proteinG: 5, carbsG: 25, fatG: 12 },
              confidenceLevel: 'verified',
            },
          ],
        },
      ],
      qa: { status: 'WARN', score: 68, iterations: 2 },
    };

    // Test Plan 3: FAIL status (red #ef4444)
    const failPlanValidated = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: false,
          targetKcal: 2000,
          meals: [
            {
              slot: 'Breakfast',
              name: 'Cereal with Milk (FAIL TEST 464)',
              cuisine: 'American',
              prepTimeMin: 5,
              nutrition: { kcal: 300, proteinG: 8, carbsG: 50, fatG: 8 },
              confidenceLevel: 'estimated',
            },
            {
              slot: 'Lunch',
              name: 'Fast Food Burger (FAIL TEST 464)',
              cuisine: 'American',
              prepTimeMin: 0,
              nutrition: { kcal: 800, proteinG: 35, carbsG: 60, fatG: 45 },
              confidenceLevel: 'estimated',
            },
            {
              slot: 'Dinner',
              name: 'Frozen Pizza (FAIL TEST 464)',
              cuisine: 'Italian',
              prepTimeMin: 5,
              cookTimeMin: 15,
              nutrition: { kcal: 900, proteinG: 30, carbsG: 100, fatG: 35 },
              confidenceLevel: 'estimated',
            },
            {
              slot: 'Snack',
              name: 'Potato Chips (FAIL TEST 464)',
              nutrition: { kcal: 250, proteinG: 3, carbsG: 25, fatG: 16 },
              confidenceLevel: 'estimated',
            },
          ],
        },
      ],
      qa: { status: 'FAIL', score: 35, iterations: 3 },
    };

    // Insert the plans
    console.log('1️⃣  Inserting PASS plan (should show green #22c55e)...');
    const insertedPass = await prisma.mealPlan.create({
      data: {
        ...basePlan,
        qaScore: 92,
        qaStatus: 'PASS',
        validatedPlan: JSON.stringify(passPlanValidated),
      },
    });
    console.log(`✅ PASS plan created with ID: ${insertedPass.id}`);

    console.log('2️⃣  Inserting WARN plan (should show amber #f59e0b)...');
    const insertedWarn = await prisma.mealPlan.create({
      data: {
        ...basePlan,
        qaScore: 68,
        qaStatus: 'WARN',
        validatedPlan: JSON.stringify(warnPlanValidated),
      },
    });
    console.log(`✅ WARN plan created with ID: ${insertedWarn.id}`);

    console.log('3️⃣  Inserting FAIL plan (should show red #ef4444)...');
    const insertedFail = await prisma.mealPlan.create({
      data: {
        ...basePlan,
        qaScore: 35,
        qaStatus: 'FAIL',
        validatedPlan: JSON.stringify(failPlanValidated),
      },
    });
    console.log(`✅ FAIL plan created with ID: ${insertedFail.id}`);

    return NextResponse.json({
      success: true,
      message: 'All test plans created successfully!',
      plans: {
        pass: { id: insertedPass.id, status: 'PASS', score: 92, color: '#22c55e (green)' },
        warn: { id: insertedWarn.id, status: 'WARN', score: 68, color: '#f59e0b (amber)' },
        fail: { id: insertedFail.id, status: 'FAIL', score: 35, color: '#ef4444 (red)' },
      },
      nextSteps: [
        '1. Visit http://localhost:3456/meal-plan',
        '2. Update active plan to test each status:',
        `   - PASS: ${insertedPass.id}`,
        `   - WARN: ${insertedWarn.id}`,
        `   - FAIL: ${insertedFail.id}`,
        '3. Verify badge colors match expected status colors',
      ],
    });

  } catch (error) {
    console.error('❌ Error creating test plans:', error);
    return NextResponse.json(
      {
        error: 'Failed to create test plans',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
