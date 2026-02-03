import { PrismaClient } from '@prisma/client';
import { QAValidator } from '@zero-sum/nutrition-engine';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function createFullTestPlan() {
  // Create a comprehensive test plan with items from all categories
  const compiledPlan = {
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
            servings: 1,
            nutrition: { kcal: 450, proteinG: 15, carbsG: 70, fatG: 12, fiberG: 8 },
            confidenceLevel: 'verified' as const,
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
            name: 'Chicken Sandwich',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 15,
            servings: 1,
            nutrition: { kcal: 600, proteinG: 40, carbsG: 50, fatG: 25, fiberG: 5 },
            confidenceLevel: 'verified' as const,
            ingredients: [
              { name: 'chicken breast', amount: 150, unit: 'g' },
              { name: 'whole wheat bread', amount: 2, unit: 'slices' },
              { name: 'romaine lettuce', amount: 50, unit: 'g' },
              { name: 'tomato', amount: 50, unit: 'g' },
              { name: 'cheddar cheese', amount: 30, unit: 'g' },
              { name: 'olive oil', amount: 5, unit: 'ml' }
            ],
            instructions: ['Grill chicken', 'Toast bread', 'Assemble sandwich'],
            primaryProtein: 'chicken',
            tags: ['high-protein']
          },
          {
            slot: 'Dinner',
            name: 'Salmon with Vegetables',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 20,
            servings: 1,
            nutrition: { kcal: 650, proteinG: 45, carbsG: 30, fatG: 35, fiberG: 6 },
            confidenceLevel: 'verified' as const,
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
          },
          {
            slot: 'Snack',
            name: 'Greek Yogurt with Fruit',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 0,
            servings: 1,
            nutrition: { kcal: 200, proteinG: 15, carbsG: 20, fatG: 5, fiberG: 2 },
            confidenceLevel: 'verified' as const,
            ingredients: [
              { name: 'greek yogurt', amount: 150, unit: 'g' },
              { name: 'banana', amount: 1, unit: 'whole' },
              { name: 'frozen berries', amount: 100, unit: 'g' },
              { name: 'honey', amount: 10, unit: 'g' }
            ],
            instructions: ['Mix all ingredients'],
            primaryProtein: 'yogurt',
            tags: ['vegetarian']
          }
        ],
        dailyTotals: { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 83, fiberG: 19 },
        varianceKcal: 0,
        variancePercent: 0
      }
    ],
    weeklyAverages: { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 83 }
  };

  // Run the QA validator to generate the grocery list
  const qaValidator = new QAValidator();
  const validatedPlan = await qaValidator.validate(compiledPlan);

  console.log('✅ Validated plan generated:');
  console.log('');
  console.log('GROCERY CATEGORIES:');
  validatedPlan.groceryList.forEach((g, i) => {
    console.log(`${i + 1}. ${g.category} (${g.items.length} items)`);
  });

  // Get or create user
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

  // Get or create profile
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

  // Deactivate existing plans
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false, status: 'replaced' }
  });

  // Insert new plan
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(validatedPlan),
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
      qaScore: validatedPlan.qa.score,
      qaStatus: validatedPlan.qa.status,
      status: 'active',
      isActive: true,
      generatedAt: new Date()
    }
  });

  console.log('');
  console.log('✅ Test plan saved to database:');
  console.log('   Plan ID:', plan.id);
  console.log('   User:', user.clerkUserId);
  console.log('   QA Score:', validatedPlan.qa.score);
  console.log('   Categories:', validatedPlan.groceryList.length);

  await prisma.$disconnect();
}

createFullTestPlan().catch(console.error);
