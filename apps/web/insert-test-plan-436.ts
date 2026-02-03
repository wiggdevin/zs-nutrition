import { PrismaClient } from '@prisma/client';

// Set DATABASE_URL explicitly for this script
process.env.DATABASE_URL = 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db';

const prisma = new PrismaClient();

async function insertTestPlan436() {
  console.log('Creating test meal plan for Feature #436 (Meal Swap Exclusion) verification...');

  // Create or get test user
  let user = await prisma.user.findFirst({
    where: { email: 'test@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'dev_test_436_user',
        email: 'test@example.com',
      },
    });
    console.log('Created test user:', user.id);
  } else {
    console.log('Found existing user:', user.id);
  }

  // Create profile
  let profile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Test User 436',
        sex: 'male',
        age: 30,
        heightCm: 177.8,
        weightKg: 77.11,
        activityLevel: 'moderately_active',
        goalType: 'maintain',
        goalRate: 1,
        bmrKcal: 1750,
        tdeeKcal: 2000,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 67,
        trainingDays: JSON.stringify([1, 3, 5]),
        dietaryStyle: 'omnivore',
        allergies: JSON.stringify([]),
        exclusions: JSON.stringify([]),
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        isActive: true,
      },
    });
    console.log('Created profile:', profile.id);
  }

  // Create onboarding state
  let onboarding = await prisma.onboardingState.findFirst({
    where: { userId: user.id },
  });

  if (!onboarding) {
    onboarding = await prisma.onboardingState.create({
      data: {
        userId: user.id,
        completed: true,
        currentStep: 7,
      },
    });
    console.log('Created onboarding state');
  }

  // Deactivate any existing plans and delete existing swaps
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, status: 'active' },
    data: { status: 'replaced' },
  });

  await prisma.mealSwap.deleteMany({
    where: { mealPlan: { userId: user.id } },
  });

  // Build the validated plan with DISTINCT meals across days for swap testing
  // Day 1 has unique meals, Day 2 has unique meals, Day 3 has unique meals
  const validatedPlanData = {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: true,
        targetKcal: 2000,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Monday_Oatmeal_Bowl',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            nutrition: {
              kcal: 450,
              proteinG: 30,
              carbsG: 50,
              fatG: 12,
              fiberG: 8,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Lunch',
            name: 'Monday_Chicken_Rice',
            cuisine: 'Asian',
            prepTimeMin: 15,
            cookTimeMin: 20,
            nutrition: {
              kcal: 600,
              proteinG: 45,
              carbsG: 60,
              fatG: 18,
              fiberG: 5,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Dinner',
            name: 'Monday_Salmon_Potato',
            cuisine: 'Mediterranean',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: {
              kcal: 650,
              proteinG: 40,
              carbsG: 55,
              fatG: 28,
              fiberG: 6,
            },
            confidenceLevel: 'ai_estimated',
          },
        ],
      },
      {
        dayNumber: 2,
        dayName: 'Tuesday',
        isTrainingDay: false,
        targetKcal: 2000,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Tuesday_Eggs_Toast',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 10,
            nutrition: {
              kcal: 500,
              proteinG: 28,
              carbsG: 45,
              fatG: 20,
              fiberG: 4,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Lunch',
            name: 'Tuesday_Beef_Bowl',
            cuisine: 'Mexican',
            prepTimeMin: 15,
            cookTimeMin: 15,
            nutrition: {
              kcal: 650,
              proteinG: 42,
              carbsG: 65,
              fatG: 22,
              fiberG: 10,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Dinner',
            name: 'Tuesday_Turkey_Meatballs',
            cuisine: 'Italian',
            prepTimeMin: 20,
            cookTimeMin: 25,
            nutrition: {
              kcal: 580,
              proteinG: 38,
              carbsG: 50,
              fatG: 24,
              fiberG: 7,
            },
            confidenceLevel: 'ai_estimated',
          },
        ],
      },
      {
        dayNumber: 3,
        dayName: 'Wednesday',
        isTrainingDay: true,
        targetKcal: 2000,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Wednesday_Smoothie',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: {
              kcal: 420,
              proteinG: 32,
              carbsG: 48,
              fatG: 14,
              fiberG: 6,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Lunch',
            name: 'Wednesday_Tacos',
            cuisine: 'Mexican',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: {
              kcal: 620,
              proteinG: 40,
              carbsG: 58,
              fatG: 24,
              fiberG: 8,
            },
            confidenceLevel: 'ai_estimated',
          },
          {
            slot: 'Dinner',
            name: 'Wednesday_Steak_Vegetables',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 20,
            nutrition: {
              kcal: 700,
              proteinG: 50,
              carbsG: 45,
              fatG: 32,
              fiberG: 7,
            },
            confidenceLevel: 'ai_estimated',
          },
        ],
      },
    ],
    groceryList: [],
    qa: {
      status: 'PASS',
      score: 92,
      iterations: 1,
      dayResults: [],
      adjustmentsMade: [],
    },
    weeklyTotals: {
      avgKcal: 2000,
      avgProteinG: 150,
      avgCarbsG: 200,
      avgFatG: 67,
    },
  };

  // Create meal plan
  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(validatedPlanData),
      metabolicProfile: JSON.stringify({
        bmrKcal: 1750,
        tdeeKcal: 2000,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 67,
      }),
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      trainingBonusKcal: 300,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 92,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
      generatedAt: new Date(),
    },
  });

  console.log('Created meal plan:', mealPlan.id);
  console.log('');
  console.log('READY FOR TESTING Feature #436:');
  console.log('- Test user email: test@example.com');
  console.log('- Plan ID:', mealPlan.id);
  console.log('');
  console.log('Plan Structure:');
  console.log('- Day 1 (Monday): Monday_Oatmeal_Bowl, Monday_Chicken_Rice, Monday_Salmon_Potato');
  console.log('- Day 2 (Tuesday): Tuesday_Eggs_Toast, Tuesday_Beef_Bowl, Tuesday_Turkey_Meatballs');
  console.log('- Day 3 (Wednesday): Wednesday_Smoothie, Wednesday_Tacos, Wednesday_Steak_Vegetables');
  console.log('');
  console.log('Test Strategy:');
  console.log('1. Click swap on Monday Breakfast (Monday_Oatmeal_Bowl)');
  console.log('2. Verify alternatives show: Tuesday_Eggs_Toast, Wednesday_Smoothie (NOT Monday_Oatmeal_Bowl)');
  console.log('3. Verify no duplicates (same meal only appears once)');

  await prisma.$disconnect();
}

insertTestPlan436()
  .then(() => {
    console.log('✅ Test plan created successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating test plan:', error);
    process.exit(1);
  });
