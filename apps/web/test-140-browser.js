/**
 * Create test data for Feature #140 browser testing
 */

require('dotenv').config({ path: '.env.local' });
process.env.DATABASE_URL =
  'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestData() {
  try {
    const email = 'test-feature-140@example.com';
    const timestamp = Date.now();

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId: email,
          email,
          isActive: true,
        },
      });
      console.log('✅ Created user:', email);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkUserId: email },
      });
      console.log('ℹ️ Using existing user:', email);
    }

    // Create onboarding state
    let onboarding = await prisma.onboardingState.findUnique({
      where: { userId: user.id },
    });

    if (!onboarding) {
      onboarding = await prisma.onboardingState.create({
        data: {
          userId: user.id,
          completed: true,
          currentStep: 6,
        },
      });
      console.log('✅ Created onboarding state');
    }

    // Create profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Test User 140',
          sex: 'male',
          age: 30,
          heightCm: 180,
          weightKg: 80,
          bodyFatPercent: 15,
          goalType: 'maintain',
          goalRate: 0.5,
          activityLevel: 'moderately_active',
          trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']),
          trainingTime: 'morning',
          dietaryStyle: 'omnivore',
          allergies: '[]',
          exclusions: '[]',
          cuisinePrefs: JSON.stringify(['italian', 'mexican']),
          mealsPerDay: 3,
          snacksPerDay: 2,
          cookingSkill: 7,
          prepTimeMax: 45,
          macroStyle: 'balanced',
          isActive: true,
        },
      });
      console.log('✅ Created profile');
    }

    // Deactivate all existing plans for this user
    await prisma.mealPlan.updateMany({
      where: { userId: user.id },
      data: { isActive: false, status: 'replaced' },
    });
    console.log('✅ Deactivated old plans');

    // Create active meal plan
    const validatedPlan = {
      days: [
        {
          dayNumber: 1,
          date: new Date().toISOString().split('T')[0],
          meals: [
            {
              slot: 'breakfast',
              name: `Test Breakfast 140-${timestamp}`,
              cuisine: 'american',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: {
                kcal: 500,
                protein: 30,
                carbs: 50,
                fat: 15,
              },
            },
          ],
        },
      ],
    };

    const metabolicProfile = {
      bmrKcal: 1800,
      tdeeKcal: 2500,
      goalKcal: 2000,
      proteinTargetG: 150,
      carbsTargetG: 200,
      fatTargetG: 70,
    };

    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify(validatedPlan),
        metabolicProfile: JSON.stringify(metabolicProfile),
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 70,
        trainingBonusKcal: 0,
        planDays: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qaScore: 95,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
      },
    });

    console.log('✅ Created active meal plan:', plan.id);
    console.log('\n===========================================');
    console.log('TEST DATA CREATED SUCCESSFULLY');
    console.log('===========================================');
    console.log('Email:', email);
    console.log('Plan ID:', plan.id);
    console.log('Plan Status:', plan.status);
    console.log('Plan IsActive:', plan.isActive);
    console.log('\nYou can now sign in with this email and test the API');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
