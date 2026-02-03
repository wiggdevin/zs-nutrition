require('dotenv').config({ path: '.env.local' });
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_PLAN = {
  dailyKcalTarget: 2000,
  dailyProteinG: 150,
  dailyCarbsG: 200,
  dailyFatG: 65,
  trainingBonusKcal: 300,
  planDays: 7,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  qaScore: 87,
  qaStatus: 'PASS',
  status: 'ACTIVE',
  generatedAt: new Date().toISOString(),
  validatedPlan: {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: true,
        targetKcal: 2300,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Oatmeal with Berries',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            nutrition: { kcal: 450, proteinG: 15, carbsG: 65, fatG: 12 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Oats', amount: 60, unit: 'g' },
              { name: 'Blueberries', amount: 100, unit: 'g' },
              { name: 'Almond milk', amount: 200, unit: 'ml' }
            ],
            instructions: ['Cook oats with milk', 'Top with berries']
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: { kcal: 550, proteinG: 45, carbsG: 20, fatG: 25 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken breast', amount: 150, unit: 'g' },
              { name: 'Mixed greens', amount: 150, unit: 'g' },
              { name: 'Olive oil', amount: 15, unit: 'ml' }
            ],
            instructions: ['Grill chicken', 'Toss with greens']
          },
          {
            slot: 'Dinner',
            name: 'Salmon with Rice',
            cuisine: 'Asian',
            prepTimeMin: 10,
            cookTimeMin: 20,
            nutrition: { kcal: 650, proteinG: 40, carbsG: 50, fatG: 28 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Salmon fillet', amount: 180, unit: 'g' },
              { name: 'Brown rice', amount: 150, unit: 'g' },
              { name: 'Broccoli', amount: 100, unit: 'g' }
            ],
            instructions: ['Bake salmon', 'Cook rice', 'Steam broccoli']
          },
          {
            slot: 'Snack',
            name: 'Greek Yogurt',
            cuisine: null,
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: { kcal: 200, proteinG: 20, carbsG: 15, fatG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Greek yogurt', amount: 200, unit: 'g' },
              { name: 'Honey', amount: 15, unit: 'g' }
            ],
            instructions: ['Mix yogurt with honey']
          }
        ]
      }
    ],
    groceryList: [
      {
        category: 'Protein',
        items: [
          { name: 'Chicken breast', amount: 500, unit: 'g' },
          { name: 'Salmon fillet', amount: 500, unit: 'g' }
        ]
      },
      {
        category: 'Produce',
        items: [
          { name: 'Blueberries', amount: 250, unit: 'g' },
          { name: 'Mixed greens', amount: 300, unit: 'g' }
        ]
      }
    ],
    qa: { status: 'PASS', score: 87 },
    weeklyTotals: {
      avgKcal: 2100,
      avgProteinG: 155,
      avgCarbsG: 195,
      avgFatG: 68
    }
  },
  metabolicProfile: {
    bmrKcal: 1800,
    tdeeKcal: 2500,
    goalKcal: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 65
  },
  profile: {
    name: 'Test User',
    sex: 'male',
    age: 30,
    goalType: 'weight_loss',
    activityLevel: 'moderate'
  }
};

(async () => {
  try {
    console.log('Looking for existing test user...');
    let user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('Creating test user...');
      user = await prisma.user.create({
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User'
        }
      });
    }

    console.log('User ID:', user.id);

    // Create UserProfile if it doesn't exist
    console.log('Checking for user profile...');
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      console.log('Creating user profile...');
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: TEST_PLAN.profile.name,
          sex: TEST_PLAN.profile.sex,
          age: TEST_PLAN.profile.age,
          goalType: TEST_PLAN.profile.goalType,
          activityLevel: TEST_PLAN.profile.activityLevel,
          weightKg: 70,
          heightCm: 175
        }
      });
    }

    console.log('Profile ID:', profile.id);
    console.log('Creating test meal plan...');
    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        dailyKcalTarget: TEST_PLAN.dailyKcalTarget,
        dailyProteinG: TEST_PLAN.dailyProteinG,
        dailyCarbsG: TEST_PLAN.dailyCarbsG,
        dailyFatG: TEST_PLAN.dailyFatG,
        trainingBonusKcal: TEST_PLAN.trainingBonusKcal,
        planDays: TEST_PLAN.planDays,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qaScore: TEST_PLAN.qaScore,
        qaStatus: TEST_PLAN.qaStatus,
        status: TEST_PLAN.status,
        validatedPlan: JSON.stringify(TEST_PLAN.validatedPlan),
        metabolicProfile: JSON.stringify(TEST_PLAN.metabolicProfile),
        isActive: true
      }
    });

    console.log('✅ Test plan created successfully!');
    console.log('Plan ID:', plan.id);
    console.log('User Email: test@example.com');
    console.log('\nYou can now sign in and view the meal plan at: http://localhost:3456/meal-plan');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
