import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function insertTestPlan() {
  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { clerkUserId: 'test-grocery-462' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'test-grocery-462',
        email: 'test-grocery-462@example.com'
      }
    });
  }

  // Check if profile exists
  let profile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true }
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Test User 462',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 75,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        allergies: '[]',
        exclusions: '[]',
        cuisinePrefs: '[]',
        trainingDays: '["Monday","Wednesday","Friday"]',
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2500,
        proteinTargetG: 150,
        carbsTargetG: 250,
        fatTargetG: 83,
        isActive: true
      }
    });
  }

  // Create a meal plan with comprehensive grocery list
  const testPlan = {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: true,
        targetKcal: 2500,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Oatmeal with Berries',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            nutrition: { kcal: 450, proteinG: 15, carbsG: 70, fatG: 12, fiberG: 8 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'rolled oats', amount: 100, unit: 'g' },
              { name: 'almond milk', amount: 250, unit: 'ml' },
              { name: 'blueberries', amount: 150, unit: 'g' },
              { name: 'honey', amount: 15, unit: 'g' },
              { name: 'almonds', amount: 20, unit: 'g' }
            ],
            instructions: ['Cook oats with milk', 'Top with berries'],
            primaryProtein: 'oats',
            tags: ['vegetarian']
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: { kcal: 550, proteinG: 45, carbsG: 30, fatG: 22, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'chicken breast', amount: 200, unit: 'g' },
              { name: 'romaine lettuce', amount: 150, unit: 'g' },
              { name: 'tomato', amount: 100, unit: 'g' },
              { name: 'cucumber', amount: 100, unit: 'g' },
              { name: 'olive oil', amount: 15, unit: 'ml' },
              { name: 'lemon', amount: 1, unit: 'whole' }
            ],
            instructions: ['Grill chicken', 'Chop vegetables', 'Mix with dressing'],
            primaryProtein: 'chicken',
            tags: ['high-protein']
          },
          {
            slot: 'Dinner',
            name: 'Salmon with Vegetables',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 20,
            nutrition: { kcal: 600, proteinG: 40, carbsG: 25, fatG: 35, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'salmon fillet', amount: 200, unit: 'g' },
              { name: 'broccoli', amount: 200, unit: 'g' },
              { name: 'sweet potato', amount: 250, unit: 'g' },
              { name: 'olive oil', amount: 15, unit: 'ml' },
              { name: 'garlic', amount: 3, unit: 'clove' },
              { name: 'salt', amount: 2, unit: 'g' },
              { name: 'black pepper', amount: 1, unit: 'g' }
            ],
            instructions: ['Roast salmon and vegetables', 'Season with spices'],
            primaryProtein: 'salmon',
            tags: ['gluten-free']
          }
        ],
        dailyTotals: { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 83, fiberG: 19 },
        varianceKcal: 0,
        variancePercent: 0
      }
    ],
    groceryList: [
      {
        category: 'Produce',
        items: [
          { name: 'blueberries', amount: 150, unit: 'g' },
          { name: 'romaine lettuce', amount: 150, unit: 'g' },
          { name: 'tomato', amount: 100, unit: 'g' },
          { name: 'cucumber', amount: 100, unit: 'g' },
          { name: 'lemon', amount: 1, unit: 'whole' },
          { name: 'broccoli', amount: 200, unit: 'g' },
          { name: 'sweet potato', amount: 250, unit: 'g' },
          { name: 'garlic', amount: 3, unit: 'clove' }
        ]
      },
      {
        category: 'Meat & Seafood',
        items: [
          { name: 'chicken breast', amount: 200, unit: 'g' },
          { name: 'salmon fillet', amount: 200, unit: 'g' }
        ]
      },
      {
        category: 'Dairy & Eggs',
        items: [
          { name: 'almond milk', amount: 250, unit: 'ml' }
        ]
      },
      {
        category: 'Grains & Bread',
        items: [
          { name: 'rolled oats', amount: 100, unit: 'g' }
        ]
      },
      {
        category: 'Nuts & Seeds',
        items: [
          { name: 'almonds', amount: 20, unit: 'g' }
        ]
      },
      {
        category: 'Oils & Condiments',
        items: [
          { name: 'olive oil', amount: 30, unit: 'ml' },
          { name: 'honey', amount: 15, unit: 'g' }
        ]
      },
      {
        category: 'Spices & Seasonings',
        items: [
          { name: 'salt', amount: 2, unit: 'g' },
          { name: 'black pepper', amount: 1, unit: 'g' }
        ]
      },
      {
        category: 'Other',
        items: []
      }
    ],
    qa: {
      status: 'PASS',
      score: 98,
      dayResults: [
        { dayNumber: 1, variancePercent: 0, status: 'PASS' }
      ],
      iterations: 1,
      adjustmentsMade: []
    },
    weeklyTotals: {
      avgKcal: 2500,
      avgProteinG: 150,
      avgCarbsG: 250,
      avgFatG: 83
    },
    generatedAt: new Date().toISOString(),
    engineVersion: '2.0.0'
  };

  // Deactivate existing plans for this user
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false, status: 'replaced' }
  });

  // Insert new plan
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(testPlan),
      metabolicProfile: JSON.stringify({
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2500,
        proteinTargetG: 150,
        carbsTargetG: 250,
        fatTargetG: 83
      }),
      dailyKcalTarget: 2500,
      dailyProteinG: 150,
      dailyCarbsG: 250,
      dailyFatG: 83,
      trainingBonusKcal: 0,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 98,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
      generatedAt: new Date()
    }
  });

  console.log('✅ Test plan created:');
  console.log('   Plan ID:', plan.id);
  console.log('   User:', user.clerkUserId);
  console.log('   Grocery categories:', testPlan.groceryList.length);
  testPlan.groceryList.forEach((g, i) => {
    console.log(`   ${i + 1}. ${g.category} (${g.items.length} items)`);
  });
  console.log('');
  console.log('To view this plan in the browser, you need to:');
  console.log('1. Sign in with the test user');
  console.log('2. Or update the API to return this plan for the active user');

  await prisma.$disconnect();
}

insertTestPlan().catch(console.error);
