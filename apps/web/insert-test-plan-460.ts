import { PrismaClient } from '@prisma/client';

// Set DATABASE_URL explicitly for this script
process.env.DATABASE_URL = 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db';

const prisma = new PrismaClient();

async function insertTestPlan460() {
  console.log('Creating test meal plan for Feature #460 (Macro Pill Colors) verification...');

  // Create or get test user
  let user = await prisma.user.findFirst({
    where: { email: 'test-460@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'dev_test_460_user',
        email: 'test-460@example.com',
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
        name: 'Test User 460',
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

  // Deactivate any existing plans
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, status: 'active' },
    data: { status: 'replaced' },
  });

  // Build the validated plan with meals showing all macro nutrients
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
            name: 'Protein-Rich Oatmeal Bowl',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            nutrition: {
              kcal: 450,
              proteinG: 35,
              carbsG: 50,
              fatG: 12,
              fiberG: 8,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_12345',
            ingredients: [
              { name: 'Oats', amount: 80, unit: 'g', fatsecretFoodId: 'ing_1' },
              { name: 'Protein Powder', amount: 30, unit: 'g', fatsecretFoodId: 'ing_2' },
              { name: 'Banana', amount: 1, unit: 'medium', fatsecretFoodId: 'ing_3' },
            ],
            instructions: ['Cook oats', 'Add protein', 'Top with banana'],
            primaryProtein: 'Whey Protein',
            tags: ['high-protein', 'vegetarian'],
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: {
              kcal: 520,
              proteinG: 45,
              carbsG: 35,
              fatG: 20,
              fiberG: 6,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_23456',
            ingredients: [
              { name: 'Chicken Breast', amount: 150, unit: 'g', fatsecretFoodId: 'ing_4' },
              { name: 'Mixed Greens', amount: 100, unit: 'g', fatsecretFoodId: 'ing_5' },
              { name: 'Olive Oil', amount: 15, unit: 'ml', fatsecretFoodId: 'ing_6' },
            ],
            instructions: ['Grill chicken', 'Mix salad', 'Combine and serve'],
            primaryProtein: 'Chicken',
            tags: ['gluten-free', 'low-carb'],
          },
          {
            slot: 'Dinner',
            name: 'Salmon with Roasted Vegetables',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: {
              kcal: 580,
              proteinG: 40,
              carbsG: 45,
              fatG: 22,
              fiberG: 10,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_34567',
            ingredients: [
              { name: 'Salmon Fillet', amount: 180, unit: 'g', fatsecretFoodId: 'ing_7' },
              { name: 'Broccoli', amount: 150, unit: 'g', fatsecretFoodId: 'ing_8' },
              { name: 'Sweet Potato', amount: 200, unit: 'g', fatsecretFoodId: 'ing_9' },
            ],
            instructions: ['Season salmon', 'Roast vegetables', 'Bake salmon'],
            primaryProtein: 'Salmon',
            tags: ['omega-3', 'high-protein'],
          },
        ],
        dailyTotals: {
          kcal: 1550,
          proteinG: 120,
          carbsG: 130,
          fatG: 54,
        },
      },
      {
        dayNumber: 2,
        dayName: 'Tuesday',
        isTrainingDay: false,
        targetKcal: 2000,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Greek Yogurt Parfait',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: {
              kcal: 380,
              proteinG: 28,
              carbsG: 40,
              fatG: 10,
              fiberG: 4,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_45678',
            ingredients: [
              { name: 'Greek Yogurt', amount: 200, unit: 'g', fatsecretFoodId: 'ing_10' },
              { name: 'Berries', amount: 100, unit: 'g', fatsecretFoodId: 'ing_11' },
              { name: 'Granola', amount: 30, unit: 'g', fatsecretFoodId: 'ing_12' },
            ],
            instructions: ['Layer yogurt and berries', 'Top with granola'],
            primaryProtein: 'Greek Yogurt',
            tags: ['vegetarian', 'quick'],
          },
          {
            slot: 'Lunch',
            name: 'Turkey Avocado Wrap',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 0,
            nutrition: {
              kcal: 480,
              proteinG: 38,
              carbsG: 42,
              fatG: 18,
              fiberG: 7,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_56789',
            ingredients: [
              { name: 'Turkey Breast', amount: 120, unit: 'g', fatsecretFoodId: 'ing_13' },
              { name: 'Whole Wheat Wrap', amount: 1, unit: 'large', fatsecretFoodId: 'ing_14' },
              { name: 'Avocado', amount: 0.5, unit: 'whole', fatsecretFoodId: 'ing_15' },
            ],
            instructions: ['Slice turkey', 'Mash avocado', 'Assemble wrap'],
            primaryProtein: 'Turkey',
            tags: ['quick', 'balanced'],
          },
          {
            slot: 'Dinner',
            name: 'Lean Beef Stir-Fry',
            cuisine: 'Asian',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: {
              kcal: 550,
              proteinG: 42,
              carbsG: 48,
              fatG: 19,
              fiberG: 6,
            },
            confidenceLevel: 'verified',
            fatsecretFoodId: 'food_67890',
            ingredients: [
              { name: 'Lean Beef', amount: 150, unit: 'g', fatsecretFoodId: 'ing_16' },
              { name: 'Mixed Vegetables', amount: 200, unit: 'g', fatsecretFoodId: 'ing_17' },
              { name: 'Brown Rice', amount: 100, unit: 'g', fatsecretFoodId: 'ing_18' },
            ],
            instructions: ['Slice beef', 'Stir-fry vegetables', 'Combine with rice'],
            primaryProtein: 'Beef',
            tags: ['high-protein', 'asian'],
          },
        ],
        dailyTotals: {
          kcal: 1410,
          proteinG: 108,
          carbsG: 130,
          fatG: 47,
        },
      },
    ],
    groceryList: [
      {
        category: 'Produce',
        items: [
          { name: 'Banana', amount: 1, unit: 'medium' },
          { name: 'Mixed Greens', amount: 100, unit: 'g' },
          { name: 'Broccoli', amount: 150, unit: 'g' },
          { name: 'Berries', amount: 100, unit: 'g' },
          { name: 'Avocado', amount: 1, unit: 'whole' },
        ],
      },
      {
        category: 'Meat and Seafood',
        items: [
          { name: 'Chicken Breast', amount: 150, unit: 'g' },
          { name: 'Salmon Fillet', amount: 180, unit: 'g' },
          { name: 'Turkey Breast', amount: 120, unit: 'g' },
          { name: 'Lean Beef', amount: 150, unit: 'g' },
        ],
      },
    ],
    qa: {
      status: 'PASS',
      score: 95,
      iterations: 1,
      adjustmentsMade: [],
    },
    weeklyTotals: {
      avgKcal: 1480,
      avgProteinG: 114,
      avgCarbsG: 130,
      avgFatG: 50.5,
    },
    generatedAt: new Date().toISOString(),
    engineVersion: '1.0.0',
  };

  const metabolicProfile = {
    bmrKcal: 1750,
    tdeeKcal: 2000,
    goalKcal: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 67,
  };

  // Create meal plan
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(validatedPlanData),
      metabolicProfile: JSON.stringify(metabolicProfile),
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      trainingBonusKcal: 0,
      planDays: 7,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      qaScore: 95,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
      generatedAt: new Date().toISOString(),
    },
  });

  console.log('Created meal plan:', plan.id);
  console.log('\n✅ Test data ready for Feature #460 verification');
  console.log('User: test-460@example.com');
  console.log('Plan ID:', plan.id);
}

insertTestPlan460()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
