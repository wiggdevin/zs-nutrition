const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  // Check for active meal plan
  const activePlan = await prisma.mealPlan.findFirst({
    where: { status: 'active' }
  });

  if (activePlan) {
    console.log('Found active meal plan:');
    console.log('ID:', activePlan.id);
    console.log('Status:', activePlan.status);
    console.log('Generated:', activePlan.generatedAt);
    console.log('Has days:', activePlan.validatedPlan?.days?.length || 0);
    process.exit(0);
  }

  console.log('No active meal plan found. Creating test plan...');

  // Create a test user
  const user = await prisma.user.upsert({
    where: { clerkUserId: 'test-user-431' },
    update: {},
    create: {
      clerkUserId: 'test-user-431',
      email: 'test-431@example.com'
    }
  });

  // Create a test profile
  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      name: 'Test User 431',
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 75,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePrefs: ['Italian', 'Mexican', 'Asian'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMax: 30,
      macroStyle: 'balanced',
      isActive: true
    }
  });

  // Create test meal plan
  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      trainingBonusKcal: 200,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 92,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
      generatedAt: new Date(),
      validatedPlan: {
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            isTrainingDay: true,
            targetKcal: 2200,
            meals: [
              {
                slot: 'breakfast',
                name: 'Greek Yogurt Parfait with Berries',
                cuisine: 'American',
                prepTimeMin: 10,
                cookTimeMin: 0,
                nutrition: { kcal: 450, proteinG: 30, carbsG: 45, fatG: 15 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'lunch',
                name: 'Grilled Chicken Caesar Salad',
                cuisine: 'American',
                prepTimeMin: 15,
                cookTimeMin: 20,
                nutrition: { kcal: 650, proteinG: 45, carbsG: 30, fatG: 35 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'dinner',
                name: 'Baked Salmon with Roasted Vegetables',
                cuisine: 'Mediterranean',
                prepTimeMin: 15,
                cookTimeMin: 25,
                nutrition: { kcal: 850, proteinG: 55, carbsG: 45, fatG: 40 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'snack',
                name: 'Apple with Almond Butter',
                cuisine: 'American',
                prepTimeMin: 5,
                cookTimeMin: 0,
                nutrition: { kcal: 250, proteinG: 5, carbsG: 30, fatG: 12 },
                confidenceLevel: 'ai_estimated'
              }
            ]
          },
          {
            dayNumber: 2,
            dayName: 'Tuesday',
            isTrainingDay: false,
            targetKcal: 2000,
            meals: [
              {
                slot: 'breakfast',
                name: 'Overnight Oats with Banana',
                cuisine: 'American',
                prepTimeMin: 5,
                cookTimeMin: 0,
                nutrition: { kcal: 400, proteinG: 15, carbsG: 65, fatG: 12 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'lunch',
                name: 'Turkey Sandwich on Whole Grain',
                cuisine: 'American',
                prepTimeMin: 10,
                cookTimeMin: 0,
                nutrition: { kcal: 550, proteinG: 35, carbsG: 50, fatG: 20 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'dinner',
                name: 'Beef Stir Fry with Brown Rice',
                cuisine: 'Asian',
                prepTimeMin: 20,
                cookTimeMin: 15,
                nutrition: { kcal: 800, proteinG: 45, carbsG: 70, fatG: 30 },
                confidenceLevel: 'verified'
              },
              {
                slot: 'snack',
                name: 'Mixed Nuts',
                cuisine: 'American',
                prepTimeMin: 0,
                cookTimeMin: 0,
                nutrition: { kcal: 250, proteinG: 8, carbsG: 10, fatG: 20 },
                confidenceLevel: 'verified'
              }
            ]
          }
        ],
        groceryList: [
          {
            category: 'Produce',
            items: [
              { name: 'Greek Yogurt', amount: 32, unit: 'oz' },
              { name: 'Berries', amount: 2, unit: 'cups' },
              { name: 'Banana', amount: 3, unit: '' }
            ]
          },
          {
            category: 'Meat and Seafood',
            items: [
              { name: 'Chicken Breast', amount: 1, unit: 'lb' },
              { name: 'Salmon Fillet', amount: 1, unit: 'lb' }
            ]
          }
        ],
        qa: {
          status: 'PASS',
          score: 92,
          iterations: 1
        }
      },
      metabolicProfile: {
        bmrKcal: 1750,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 67
      }
    }
  });

  console.log('Created test meal plan:');
  console.log('ID:', mealPlan.id);
  console.log('Status:', mealPlan.status);
  console.log('Has days:', mealPlan.validatedPlan?.days?.length || 0);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
