/**
 * Test script for Feature #464: QA score badge styling reflects status
 *
 * Creates meal plans with different QA statuses (PASS, WARN, FAIL)
 * to verify the badge displays correct colors.
 */

require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertTestPlans() {
  console.log('🧪 Inserting test plans for Feature #464...\n');

  try {
    // Get a user ID (first available user)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users found. Please create a user first.');
      process.exit(1);
    }

    const basePlan = {
      userId: user.id,
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
    };

    // Test Plan 1: PASS status (green)
    const passPlan = {
      ...basePlan,
      qaScore: 92,
      qaStatus: 'PASS',
      validatedPlan: {
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            isTrainingDay: false,
            targetKcal: 2000,
            meals: [
              {
                slot: 'Breakfast',
                name: 'Oatmeal with Berries (PASS TEST)',
                cuisine: 'American',
                prepTimeMin: 10,
                cookTimeMin: 5,
                nutrition: { kcal: 450, proteinG: 15, carbsG: 65, fatG: 12 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Lunch',
                name: 'Grilled Chicken Salad (PASS TEST)',
                cuisine: 'Mediterranean',
                prepTimeMin: 15,
                cookTimeMin: 20,
                nutrition: { kcal: 550, proteinG: 45, carbsG: 30, fatG: 22 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Dinner',
                name: 'Salmon with Vegetables (PASS TEST)',
                cuisine: 'European',
                prepTimeMin: 10,
                cookTimeMin: 25,
                nutrition: { kcal: 600, proteinG: 50, carbsG: 25, fatG: 30 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Snack',
                name: 'Greek Yogurt (PASS TEST)',
                nutrition: { kcal: 200, proteinG: 20, carbsG: 15, fatG: 5 },
                confidenceLevel: 'verified',
              },
            ],
          },
        ],
        qa: { status: 'PASS', score: 92, iterations: 1 },
      },
      profile: {
        name: 'Test User PASS',
        sex: 'male',
        age: 30,
        goalType: 'maintain',
        activityLevel: 'moderate',
      },
    };

    // Test Plan 2: WARN status (amber)
    const warnPlan = {
      ...basePlan,
      qaScore: 68,
      qaStatus: 'WARN',
      validatedPlan: {
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            isTrainingDay: false,
            targetKcal: 2000,
            meals: [
              {
                slot: 'Breakfast',
                name: 'Toast with Eggs (WARN TEST)',
                cuisine: 'American',
                prepTimeMin: 10,
                cookTimeMin: 5,
                nutrition: { kcal: 450, proteinG: 15, carbsG: 65, fatG: 12 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Lunch',
                name: 'Turkey Sandwich (WARN TEST)',
                cuisine: 'American',
                prepTimeMin: 10,
                nutrition: { kcal: 550, proteinG: 35, carbsG: 50, fatG: 18 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Dinner',
                name: 'Pasta with Meat Sauce (WARN TEST)',
                cuisine: 'Italian',
                prepTimeMin: 15,
                cookTimeMin: 30,
                nutrition: { kcal: 700, proteinG: 35, carbsG: 75, fatG: 25 },
                confidenceLevel: 'verified',
              },
              {
                slot: 'Snack',
                name: 'Apple with Peanut Butter (WARN TEST)',
                nutrition: { kcal: 200, proteinG: 5, carbsG: 25, fatG: 12 },
                confidenceLevel: 'verified',
              },
            ],
          },
        ],
        qa: { status: 'WARN', score: 68, iterations: 2 },
      },
      profile: {
        name: 'Test User WARN',
        sex: 'female',
        age: 28,
        goalType: 'lose',
        activityLevel: 'light',
      },
    };

    // Test Plan 3: FAIL status (red)
    const failPlan = {
      ...basePlan,
      qaScore: 35,
      qaStatus: 'FAIL',
      validatedPlan: {
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            isTrainingDay: false,
            targetKcal: 2000,
            meals: [
              {
                slot: 'Breakfast',
                name: 'Cereal with Milk (FAIL TEST)',
                cuisine: 'American',
                prepTimeMin: 5,
                nutrition: { kcal: 300, proteinG: 8, carbsG: 50, fatG: 8 },
                confidenceLevel: 'estimated',
              },
              {
                slot: 'Lunch',
                name: 'Fast Food Burger (FAIL TEST)',
                cuisine: 'American',
                prepTimeMin: 0,
                nutrition: { kcal: 800, proteinG: 35, carbsG: 60, fatG: 45 },
                confidenceLevel: 'estimated',
              },
              {
                slot: 'Dinner',
                name: 'Frozen Pizza (FAIL TEST)',
                cuisine: 'Italian',
                prepTimeMin: 5,
                cookTimeMin: 15,
                nutrition: { kcal: 900, proteinG: 30, carbsG: 100, fatG: 35 },
                confidenceLevel: 'estimated',
              },
              {
                slot: 'Snack',
                name: 'Potato Chips (FAIL TEST)',
                nutrition: { kcal: 250, proteinG: 3, carbsG: 25, fatG: 16 },
                confidenceLevel: 'estimated',
              },
            ],
          },
        ],
        qa: { status: 'FAIL', score: 35, iterations: 3 },
      },
      profile: {
        name: 'Test User FAIL',
        sex: 'male',
        age: 35,
        goalType: 'gain',
        activityLevel: 'sedentary',
      },
    };

    // Insert the plans
    console.log('1️⃣  Inserting PASS plan (should show green #22c55e)...');
    const insertedPass = await prisma.mealPlan.create({
      data: passPlan,
    });
    console.log(`✅ PASS plan created with ID: ${insertedPass.id}`);

    console.log('\n2️⃣  Inserting WARN plan (should show amber #f59e0b)...');
    const insertedWarn = await prisma.mealPlan.create({
      data: warnPlan,
    });
    console.log(`✅ WARN plan created with ID: ${insertedWarn.id}`);

    console.log('\n3️⃣  Inserting FAIL plan (should show red #ef4444)...');
    const insertedFail = await prisma.mealPlan.create({
      data: failPlan,
    });
    console.log(`✅ FAIL plan created with ID: ${insertedFail.id}`);

    console.log('\n✨ All test plans created successfully!\n');
    console.log('📋 Next steps:');
    console.log('1. Navigate to http://localhost:3456/meal-plan');
    console.log('2. Update the active plan ID to test each status:');
    console.log(`   - PASS: ${insertedPass.id}`);
    console.log(`   - WARN: ${insertedWarn.id}`);
    console.log(`   - FAIL: ${insertedFail.id}`);
    console.log('3. Verify the badge colors match the expected status colors\n');

  } catch (error) {
    console.error('❌ Error creating test plans:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestPlans();
