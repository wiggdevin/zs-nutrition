require('dotenv').config({ path: '.env.local' });
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_PLAN = {
  dailyKcalTarget: 2257,
  dailyProteinG: 188,
  dailyCarbsG: 251,
  dailyFatG: 84,
  trainingBonusKcal: 0,
  planDays: 7,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  qaScore: 92,
  qaStatus: 'PASS',
  status: 'ACTIVE',
  generatedAt: new Date().toISOString(),
  validatedPlan: {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: false,
        targetKcal: 2257,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Greek Yogurt Parfait with Berries',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: { kcal: 380, proteinG: 28, carbsG: 42, fatG: 10 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Greek yogurt', amount: 200, unit: 'g' },
              { name: 'Blueberries', amount: 100, unit: 'g' },
              { name: 'Honey', amount: 15, unit: 'g' }
            ],
            instructions: ['Layer yogurt and berries', 'Drizzle with honey']
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 12,
            nutrition: { kcal: 620, proteinG: 52, carbsG: 28, fatG: 30 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken breast', amount: 170, unit: 'g' },
              { name: 'Mixed greens', amount: 150, unit: 'g' },
              { name: 'Cherry tomatoes', amount: 100, unit: 'g' },
              { name: 'Olive oil', amount: 20, unit: 'ml' },
              { name: 'Lemon juice', amount: 15, unit: 'ml' }
            ],
            instructions: ['Grill chicken', 'Toss with greens and dressing']
          },
          {
            slot: 'Dinner',
            name: 'Baked Salmon with Rice and Broccoli',
            cuisine: 'Asian',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: { kcal: 780, proteinG: 54, carbsG: 62, fatG: 28 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Salmon fillet', amount: 200, unit: 'g' },
              { name: 'Brown rice', amount: 180, unit: 'g' },
              { name: 'Broccoli', amount: 150, unit: 'g' },
              { name: 'Soy sauce', amount: 15, unit: 'ml' },
              { name: 'Garlic', amount: 3, unit: 'g' }
            ],
            instructions: ['Bake salmon', 'Cook rice', 'Steam broccoli']
          },
          {
            slot: 'Snack',
            name: 'Apple with Almond Butter',
            cuisine: null,
            prepTimeMin: 3,
            cookTimeMin: 0,
            nutrition: { kcal: 280, proteinG: 6, carbsG: 32, fatG: 14 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Apple', amount: 150, unit: 'g' },
              { name: 'Almond butter', amount: 20, unit: 'g' }
            ],
            instructions: ['Slice apple', 'Serve with almond butter']
          }
        ]
      },
      {
        dayNumber: 2,
        dayName: 'Tuesday',
        isTrainingDay: false,
        targetKcal: 2257,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Oatmeal with Banana and Walnuts',
            cuisine: 'American',
            prepTimeMin: 8,
            cookTimeMin: 5,
            nutrition: { kcal: 450, proteinG: 14, carbsG: 68, fatG: 14 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Rolled oats', amount: 60, unit: 'g' },
              { name: 'Banana', amount: 100, unit: 'g' },
              { name: 'Walnuts', amount: 20, unit: 'g' },
              { name: 'Whole milk', amount: 200, unit: 'ml' }
            ],
            instructions: ['Cook oats with milk', 'Top with banana and walnuts']
          },
          {
            slot: 'Lunch',
            name: 'Turkey Sandwich on Whole Wheat',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 0,
            nutrition: { kcal: 580, proteinG: 38, carbsG: 62, fatG: 18 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Whole wheat bread', amount: 80, unit: 'g' },
              { name: 'Turkey breast', amount: 120, unit: 'g' },
              { name: 'Cheddar cheese', amount: 30, unit: 'g' },
              { name: 'Lettuce', amount: 30, unit: 'g' },
              { name: 'Tomato', amount: 50, unit: 'g' }
            ],
            instructions: ['Assemble sandwich']
          },
          {
            slot: 'Dinner',
            name: 'Beef Stir Fry with Vegetables',
            cuisine: 'Asian',
            prepTimeMin: 15,
            cookTimeMin: 12,
            nutrition: { kcal: 720, proteinG: 48, carbsG: 52, fatG: 30 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Beef sirloin', amount: 180, unit: 'g' },
              { name: 'Bell peppers', amount: 150, unit: 'g' },
              { name: 'Snap peas', amount: 100, unit: 'g' },
              { name: 'Soy sauce', amount: 20, unit: 'ml' },
              { name: 'Sesame oil', amount: 10, unit: 'ml' }
            ],
            instructions: ['Stir fry beef and vegetables']
          },
          {
            slot: 'Snack',
            name: 'Cottage Cheese with Pineapple',
            cuisine: null,
            prepTimeMin: 3,
            cookTimeMin: 0,
            nutrition: { kcal: 240, proteinG: 22, carbsG: 24, fatG: 8 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Cottage cheese', amount: 150, unit: 'g' },
              { name: 'Pineapple chunks', amount: 80, unit: 'g' }
            ],
            instructions: ['Mix cottage cheese with pineapple']
          }
        ]
      }
    ],
    // Complete grocery list with all 7 store sections
    groceryList: [
      {
        category: 'Produce',
        items: [
          { name: 'Blueberries', amount: 100, unit: 'g' },
          { name: 'Mixed greens', amount: 150, unit: 'g' },
          { name: 'Cherry tomatoes', amount: 100, unit: 'g' },
          { name: 'Broccoli', amount: 150, unit: 'g' },
          { name: 'Banana', amount: 100, unit: 'g' },
          { name: 'Apple', amount: 150, unit: 'g' },
          { name: 'Lettuce', amount: 30, unit: 'g' },
          { name: 'Tomato', amount: 50, unit: 'g' },
          { name: 'Bell peppers', amount: 150, unit: 'g' },
          { name: 'Snap peas', amount: 100, unit: 'g' },
          { name: 'Pineapple chunks', amount: 80, unit: 'g' },
          { name: 'Garlic', amount: 10, unit: 'g' },
          { name: 'Lemon', amount: 1, unit: 'whole' }
        ]
      },
      {
        category: 'Meat and Seafood',
        items: [
          { name: 'Chicken breast', amount: 170, unit: 'g' },
          { name: 'Salmon fillet', amount: 200, unit: 'g' },
          { name: 'Turkey breast', amount: 120, unit: 'g' },
          { name: 'Beef sirloin', amount: 180, unit: 'g' }
        ]
      },
      {
        category: 'Dairy and Eggs',
        items: [
          { name: 'Greek yogurt', amount: 200, unit: 'g' },
          { name: 'Cheddar cheese', amount: 30, unit: 'g' },
          { name: 'Cottage cheese', amount: 150, unit: 'g' },
          { name: 'Whole milk', amount: 200, unit: 'ml' }
        ]
      },
      {
        category: 'Bakery',
        items: [
          { name: 'Whole wheat bread', amount: 80, unit: 'g' }
        ]
      },
      {
        category: 'Pantry',
        items: [
          { name: 'Rolled oats', amount: 60, unit: 'g' },
          { name: 'Walnuts', amount: 20, unit: 'g' },
          { name: 'Almond butter', amount: 20, unit: 'g' },
          { name: 'Brown rice', amount: 180, unit: 'g' },
          { name: 'Honey', amount: 15, unit: 'g' },
          { name: 'Olive oil', amount: 35, unit: 'ml' },
          { name: 'Soy sauce', amount: 35, unit: 'ml' },
          { name: 'Sesame oil', amount: 10, unit: 'ml' }
        ]
      },
      {
        category: 'Frozen',
        items: [
          { name: 'Frozen mixed berries', amount: 200, unit: 'g' }
        ]
      },
      {
        category: 'Other',
        items: [
          { name: 'Salt', amount: 10, unit: 'g' },
          { name: 'Black pepper', amount: 5, unit: 'g' }
        ]
      }
    ],
    qa: { status: 'PASS', score: 92 },
    weeklyTotals: {
      avgKcal: 2257,
      avgProteinG: 188,
      avgCarbsG: 251,
      avgFatG: 84
    }
  },
  metabolicProfile: {
    bmrKcal: 1850,
    tdeeKcal: 2757,
    goalKcal: 2257,
    proteinTargetG: 188,
    carbsTargetG: 251,
    fatTargetG: 84
  },
  profile: {
    name: 'FEATURE_166_TEST',
    sex: 'male',
    age: 30,
    goalType: 'maintain',
    activityLevel: 'moderately_active'
  }
};

(async () => {
  try {
    console.log('Creating FEATURE_166 test plan with complete grocery list...');
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
          weightKg: 81.6,
          heightCm: 177.8
        }
      });
    }

    console.log('Profile ID:', profile.id);

    // Deactivate any existing plans
    console.log('Deactivating existing plans...');
    await prisma.mealPlan.updateMany({
      where: { userId: user.id },
      data: { isActive: false, status: 'replaced' }
    });

    console.log('Creating test meal plan with complete grocery list...');
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

    console.log('✅ FEATURE_166 test plan created successfully!');
    console.log('Plan ID:', plan.id);
    console.log('User Email: test@example.com');
    console.log('\nGrocery List Categories:');
    TEST_PLAN.validatedPlan.groceryList.forEach(cat => {
      console.log(`  - ${cat.category}: ${cat.items.length} items`);
    });
    console.log('\nYou can now view the meal plan at: http://localhost:3456/meal-plan');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
