import { PrismaClient } from '@prisma/client';

// Set DATABASE_URL explicitly for this script
process.env.DATABASE_URL = 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db';

const prisma = new PrismaClient();

async function insertTestPlan420() {
  console.log('Creating test meal plan for Feature #420 (Swap History) verification...');

  // Create or get test user
  let user = await prisma.user.findFirst({
    where: { email: 'test-420-swap@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'dev_test_420_user',
        email: 'test-420-swap@example.com',
      },
    });
    console.log('Created test user:', user.id);
  }

  // Create profile
  let profile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Test User 420',
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

  // Build the validated plan with distinct meals for easy swap testing
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
            name: 'ORIGINAL_Oatmeal with Protein Powder',
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
            ingredients: [
              { name: 'Oats', amount: 60, unit: 'g' },
              { name: 'Protein Powder', amount: 30, unit: 'g' },
              { name: 'Blueberries', amount: 100, unit: 'g' },
            ],
            instructions: ['Cook oats', 'Add protein powder', 'Top with berries'],
          },
          {
            slot: 'Lunch',
            name: 'ORIGINAL_Chicken Breast with Rice',
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
            ingredients: [
              { name: 'Chicken Breast', amount: 150, unit: 'g' },
              { name: 'Brown Rice', amount: 200, unit: 'g' },
              { name: 'Broccoli', amount: 100, unit: 'g' },
            ],
            instructions: ['Cook chicken', 'Prepare rice', 'Steam broccoli'],
          },
          {
            slot: 'Dinner',
            name: 'ORIGINAL_Salmon with Sweet Potato',
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
            ingredients: [
              { name: 'Salmon Fillet', amount: 180, unit: 'g' },
              { name: 'Sweet Potato', amount: 250, unit: 'g' },
              { name: 'Asparagus', amount: 100, unit: 'g' },
            ],
            instructions: ['Bake salmon', 'Roast sweet potato', 'Grill asparagus'],
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
            name: 'ORIGINAL_Eggs and Toast',
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
            ingredients: [
              { name: 'Eggs', amount: 3, unit: 'large' },
              { name: 'Whole Wheat Bread', amount: 60, unit: 'g' },
              { name: 'Butter', amount: 15, unit: 'g' },
            ],
            instructions: ['Scramble eggs', 'Toast bread', 'Serve with butter'],
          },
          {
            slot: 'Lunch',
            name: 'ORIGINAL_Beef Bowl',
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
            ingredients: [
              { name: 'Ground Beef', amount: 150, unit: 'g' },
              { name: 'Black Beans', amount: 150, unit: 'g' },
              { name: 'Rice', amount: 150, unit: 'g' },
            ],
            instructions: ['Brown beef', 'Heat beans', 'Cook rice'],
          },
          {
            slot: 'Dinner',
            name: 'ORIGINAL_Turkey Meatballs',
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
            ingredients: [
              { name: 'Ground Turkey', amount: 180, unit: 'g' },
              { name: 'Pasta', amount: 120, unit: 'g' },
              { name: 'Marinara Sauce', amount: 150, unit: 'g' },
            ],
            instructions: ['Form meatballs', 'Bake', 'Serve with pasta and sauce'],
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
  console.log('Plan has meals with ORIGINAL_ prefix for easy identification');
  console.log('');
  console.log('READY FOR TESTING: Perform 3 meal swaps and verify MealSwap records are created');
  console.log('Test user email: test-420-swap@example.com');
  console.log('Plan ID:', mealPlan.id);

  await prisma.$disconnect();
}

insertTestPlan420()
  .then(() => {
    console.log('✅ Test plan created successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating test plan:', error);
    process.exit(1);
  });
