import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function insertTestPlan414() {
  console.log('Creating test meal plan for Feature #414...');

  // Create or get test user
  let user = await prisma.user.findFirst({
    where: { email: 'test-414-training@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'dev_test_414_user',
        email: 'test-414-training@example.com',
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
        name: 'Test User 414',
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
        trainingDays: [1, 3, 5], // Monday, Wednesday, Friday
        trainingBonusKcal: 300,
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
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

  // Create test meal plan with training days
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      status: 'active',
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      trainingBonusKcal: 300,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 95,
      qaStatus: 'approved',
      generatedAt: new Date(),
      validatedPlan: {
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            isTrainingDay: true,
            targetKcal: 2300, // 2000 + 300 bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Oatmeal with Protein Powder',
                nutrition: { kcal: 550, proteinG: 35, carbsG: 65, fatG: 12 },
                confidenceLevel: 'verified',
                prepTimeMin: 10,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Grilled Chicken Salad',
                nutrition: { kcal: 650, proteinG: 45, carbsG: 40, fatG: 22 },
                confidenceLevel: 'verified',
                prepTimeMin: 20,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Salmon with Sweet Potato',
                nutrition: { kcal: 700, proteinG: 40, carbsG: 55, fatG: 28 },
                confidenceLevel: 'verified',
                prepTimeMin: 25,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Greek Yogurt with Berries',
                nutrition: { kcal: 400, proteinG: 20, carbsG: 40, fatG: 10 },
                confidenceLevel: 'verified',
                prepTimeMin: 5,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 2,
            dayName: 'Tuesday',
            isTrainingDay: false,
            targetKcal: 2000, // No bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Eggs and Toast',
                nutrition: { kcal: 500, proteinG: 25, carbsG: 45, fatG: 18 },
                confidenceLevel: 'verified',
                prepTimeMin: 10,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Turkey Wrap',
                nutrition: { kcal: 600, proteinG: 35, carbsG: 50, fatG: 20 },
                confidenceLevel: 'verified',
                prepTimeMin: 15,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Chicken Stir Fry',
                nutrition: { kcal: 650, proteinG: 38, carbsG: 52, fatG: 22 },
                confidenceLevel: 'verified',
                prepTimeMin: 20,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Apple and Almonds',
                nutrition: { kcal: 250, proteinG: 8, carbsG: 30, fatG: 12 },
                confidenceLevel: 'verified',
                prepTimeMin: 2,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 3,
            dayName: 'Wednesday',
            isTrainingDay: true,
            targetKcal: 2300, // 2000 + 300 bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Protein Pancakes',
                nutrition: { kcal: 580, proteinG: 32, carbsG: 68, fatG: 14 },
                confidenceLevel: 'verified',
                prepTimeMin: 15,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Beef Burrito Bowl',
                nutrition: { kcal: 670, proteinG: 42, carbsG: 58, fatG: 21 },
                confidenceLevel: 'verified',
                prepTimeMin: 20,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Lean Steak with Veggies',
                nutrition: { kcal: 720, proteinG: 48, carbsG: 45, fatG: 26 },
                confidenceLevel: 'verified',
                prepTimeMin: 25,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Protein Shake',
                nutrition: { kcal: 330, proteinG: 28, carbsG: 35, fatG: 8 },
                confidenceLevel: 'verified',
                prepTimeMin: 3,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 4,
            dayName: 'Thursday',
            isTrainingDay: false,
            targetKcal: 2000, // No bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Avocado Toast',
                nutrition: { kcal: 480, proteinG: 18, carbsG: 52, fatG: 20 },
                confidenceLevel: 'verified',
                prepTimeMin: 10,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Tuna Salad',
                nutrition: { kcal: 580, proteinG: 40, carbsG: 35, fatG: 24 },
                confidenceLevel: 'verified',
                prepTimeMin: 15,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Grilled Fish with Rice',
                nutrition: { kcal: 670, proteinG: 42, carbsG: 60, fatG: 18 },
                confidenceLevel: 'verified',
                prepTimeMin: 25,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Hummus and Veggies',
                nutrition: { kcal: 270, proteinG: 10, carbsG: 32, fatG: 12 },
                confidenceLevel: 'verified',
                prepTimeMin: 5,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 5,
            dayName: 'Friday',
            isTrainingDay: true,
            targetKcal: 2300, // 2000 + 300 bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Smoothie Bowl',
                nutrition: { kcal: 560, proteinG: 30, carbsG: 72, fatG: 11 },
                confidenceLevel: 'verified',
                prepTimeMin: 10,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Chicken Quinoa Bowl',
                nutrition: { kcal: 680, proteinG: 44, carbsG: 62, fatG: 19 },
                confidenceLevel: 'verified',
                prepTimeMin: 20,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Shrimp and Pasta',
                nutrition: { kcal: 710, proteinG: 38, carbsG: 68, fatG: 23 },
                confidenceLevel: 'verified',
                prepTimeMin: 25,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Cottage Cheese with Fruit',
                nutrition: { kcal: 350, proteinG: 22, carbsG: 38, fatG: 11 },
                confidenceLevel: 'verified',
                prepTimeMin: 5,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 6,
            dayName: 'Saturday',
            isTrainingDay: false,
            targetKcal: 2000, // No bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'French Toast',
                nutrition: { kcal: 520, proteinG: 20, carbsG: 68, fatG: 16 },
                confidenceLevel: 'verified',
                prepTimeMin: 15,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Veggie Pizza',
                nutrition: { kcal: 640, proteinG: 28, carbsG: 82, fatG: 20 },
                confidenceLevel: 'verified',
                prepTimeMin: 30,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Baked Cod with Potatoes',
                nutrition: { kcal: 660, proteinG: 40, carbsG: 58, fatG: 21 },
                confidenceLevel: 'verified',
                prepTimeMin: 35,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Trail Mix',
                nutrition: { kcal: 180, proteinG: 6, carbsG: 18, fatG: 10 },
                confidenceLevel: 'verified',
                prepTimeMin: 1,
                ingredients: [],
              },
            ],
          },
          {
            dayNumber: 7,
            dayName: 'Sunday',
            isTrainingDay: false,
            targetKcal: 2000, // No bonus
            meals: [
              {
                slot: 'Breakfast',
                name: 'Bagel with Cream Cheese',
                nutrition: { kcal: 490, proteinG: 16, carbsG: 62, fatG: 18 },
                confidenceLevel: 'verified',
                prepTimeMin: 8,
                ingredients: [],
              },
              {
                slot: 'Lunch',
                name: 'Chicken Sandwich',
                nutrition: { kcal: 620, proteinG: 36, carbsG: 58, fatG: 21 },
                confidenceLevel: 'verified',
                prepTimeMin: 15,
                ingredients: [],
              },
              {
                slot: 'Dinner',
                name: 'Roast Chicken Dinner',
                nutrition: { kcal: 720, proteinG: 45, carbsG: 55, fatG: 28 },
                confidenceLevel: 'verified',
                prepTimeMin: 60,
                ingredients: [],
              },
              {
                slot: 'Snack',
                name: 'Orange and Walnuts',
                nutrition: { kcal: 170, proteinG: 5, carbsG: 20, fatG: 11 },
                confidenceLevel: 'verified',
                prepTimeMin: 2,
                ingredients: [],
              },
            ],
          },
        ],
        groceryList: [],
        weeklyTotals: {
          avgKcal: 2143, // Average across 7 days (3 training days + 4 rest days)
          avgProteinG: 150,
          avgCarbsG: 200,
          avgFatG: 67,
        },
      },
      metabolicProfile: {
        bmrKcal: 1750,
        tdeeKcal: 2000,
        goalKcal: 2000,
      },
      profile: {
        name: 'Test User 414',
        sex: 'male',
        age: 30,
        goalType: 'maintain',
        activityLevel: 'moderately_active',
      },
    },
  });

  console.log('✅ Created test meal plan:', plan.id);
  console.log('');
  console.log('Plan Details:');
  console.log('  Base calories: 2000 kcal');
  console.log('  Training bonus: 300 kcal');
  console.log('  Training days: Monday, Wednesday, Friday');
  console.log('');
  console.log('Day-by-Day Breakdown:');
  console.log('  Monday (Day 1):    Training - 2300 kcal (💪)');
  console.log('  Tuesday (Day 2):   Rest - 2000 kcal');
  console.log('  Wednesday (Day 3): Training - 2300 kcal (💪)');
  console.log('  Thursday (Day 4):  Rest - 2000 kcal');
  console.log('  Friday (Day 5):    Training - 2300 kcal (💪)');
  console.log('  Saturday (Day 6):  Rest - 2000 kcal');
  console.log('  Sunday (Day 7):    Rest - 2000 kcal');
  console.log('');
  console.log('To view the meal plan:');
  console.log('  1. Set cookie: dev-user-id=' + user.id);
  console.log('  2. Navigate to: http://localhost:3456/meal-plan');
  console.log('');
  console.log('Test user email: test-414-training@example.com');

  await prisma.$disconnect();
}

insertTestPlan414().catch(console.error);
