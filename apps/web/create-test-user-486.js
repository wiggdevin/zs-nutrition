require('dotenv').config({ path: '.env.local' });
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUserAndPlan() {
  try {
    // Create or get test user
    const email = 'feature-486-test@example.com';
    const clerkUserId = 'test-user-486-' + Date.now();

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email,
          isActive: true
        }
      });
      console.log('Created test user:', email);
    } else {
      console.log('Using existing user:', email);
    }

    // Create profile if not exists
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true }
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Feature 486 Test User',
          sex: 'male',
          age: 30,
          heightCm: 180,
          weightKg: 80,
          goalType: 'maintain',
          goalRate: 0,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          allergies: '',
          exclusions: '',
          cuisinePrefs: '',
          trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']),
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
          fatTargetG: 80,
          isActive: true
        }
      });
      console.log('Created profile');
    }

    // Create active meal plan
    const validatedPlan = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: true,
          targetKcal: 2500,
          meals: [
            {
              slot: 'breakfast',
              name: 'Oatmeal with Berries - 486',
              cuisine: 'American',
              prepTimeMin: 10,
              cookTimeMin: 5,
              nutrition: { kcal: 500, proteinG: 20, carbsG: 70, fatG: 15 },
              confidenceLevel: 'verified',
              ingredients: [
                { name: 'Oats', amount: 60, unit: 'g' },
                { name: 'Berries', amount: 100, unit: 'g' },
                { name: 'Milk', amount: 250, unit: 'ml' }
              ],
              instructions: ['Cook oats', 'Add berries', 'Serve']
            },
            {
              slot: 'lunch',
              name: 'Chicken Salad - 486',
              cuisine: 'Mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 0,
              nutrition: { kcal: 600, proteinG: 45, carbsG: 40, fatG: 25 },
              confidenceLevel: 'verified',
              ingredients: [
                { name: 'Chicken breast', amount: 150, unit: 'g' },
                { name: 'Mixed greens', amount: 100, unit: 'g' }
              ],
              instructions: ['Grill chicken', 'Mix salad', 'Combine']
            },
            {
              slot: 'dinner',
              name: 'Salmon with Rice - 486',
              cuisine: 'Asian',
              prepTimeMin: 10,
              cookTimeMin: 20,
              nutrition: { kcal: 700, proteinG: 50, carbsG: 60, fatG: 30 },
              confidenceLevel: 'verified',
              ingredients: [
                { name: 'Salmon fillet', amount: 200, unit: 'g' },
                { name: 'Rice', amount: 150, unit: 'g' }
              ],
              instructions: ['Cook rice', 'Bake salmon', 'Serve together']
            },
            {
              slot: 'snack',
              name: 'Greek Yogurt - 486',
              cuisine: 'Greek',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 200, proteinG: 15, carbsG: 20, fatG: 5 },
              confidenceLevel: 'verified',
              ingredients: [
                { name: 'Greek yogurt', amount: 200, unit: 'g' },
                { name: 'Honey', amount: 15, unit: 'ml' }
              ],
              instructions: ['Mix yogurt with honey', 'Serve']
            }
          ]
        },
        {
          dayNumber: 2,
          dayName: 'Tuesday',
          isTrainingDay: false,
          targetKcal: 2300,
          meals: [
            {
              slot: 'breakfast',
              name: 'Eggs and Toast - 486',
              cuisine: 'American',
              prepTimeMin: 10,
              cookTimeMin: 10,
              nutrition: { kcal: 450, proteinG: 22, carbsG: 50, fatG: 18 },
              confidenceLevel: 'verified'
            },
            {
              slot: 'lunch',
              name: 'Turkey Sandwich - 486',
              cuisine: 'American',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 550, proteinG: 35, carbsG: 60, fatG: 18 },
              confidenceLevel: 'verified'
            },
            {
              slot: 'dinner',
              name: 'Beef Stir Fry - 486',
              cuisine: 'Asian',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 650, proteinG: 45, carbsG: 55, fatG: 28 },
              confidenceLevel: 'verified'
            },
            {
              slot: 'snack',
              name: 'Apple and Almonds - 486',
              cuisine: 'American',
              prepTimeMin: 2,
              cookTimeMin: 0,
              nutrition: { kcal: 180, proteinG: 5, carbsG: 25, fatG: 8 },
              confidenceLevel: 'verified'
            }
          ]
        }
      ],
      groceryList: [
        {
          category: 'Produce',
          items: [
            { name: 'Berries - 486', amount: 100, unit: 'g' },
            { name: 'Mixed greens', amount: 100, unit: 'g' },
            { name: 'Apple', amount: 2, unit: 'pieces' }
          ]
        },
        {
          category: 'Meat and Seafood',
          items: [
            { name: 'Chicken breast', amount: 150, unit: 'g' },
            { name: 'Salmon fillet', amount: 200, unit: 'g' },
            { name: 'Ground beef', amount: 200, unit: 'g' }
          ]
        },
        {
          category: 'Dairy and Eggs',
          items: [
            { name: 'Milk', amount: 250, unit: 'ml' },
            { name: 'Greek yogurt', amount: 200, unit: 'g' },
            { name: 'Eggs', amount: 6, unit: 'pieces' }
          ]
        },
        {
          category: 'Pantry',
          items: [
            { name: 'Oats', amount: 60, unit: 'g' },
            { name: 'Rice', amount: 150, unit: 'g' },
            { name: 'Bread', amount: 4, unit: 'slices' }
          ]
        }
      ],
      qa: {
        status: 'PASS',
        score: 92,
        iterations: 1,
        adjustmentsMade: []
      },
      weeklyTotals: {
        avgKcal: 2400,
        avgProteinG: 148,
        avgCarbsG: 245,
        avgFatG: 78
      }
    };

    const metabolicProfile = {
      bmrKcal: 1800,
      tdeeKcal: 2500,
      goalKcal: 2500,
      proteinTargetG: 150,
      carbsTargetG: 250,
      fatTargetG: 80
    };

    // Deactivate any existing active plans for this user
    await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, status: 'replaced' }
    });

    // Create new active meal plan
    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify(validatedPlan),
        metabolicProfile: JSON.stringify(metabolicProfile),
        dailyKcalTarget: 2500,
        dailyProteinG: 150,
        dailyCarbsG: 250,
        dailyFatG: 80,
        trainingBonusKcal: 200,
        planDays: 7,
        startDate,
        endDate,
        qaScore: 92,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
        generatedAt: new Date()
      }
    });

    console.log('Created active meal plan:', mealPlan.id);
    console.log('Email:', email);
    console.log('Plan ID:', mealPlan.id);
    console.log('Status: ACTIVE');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUserAndPlan();
