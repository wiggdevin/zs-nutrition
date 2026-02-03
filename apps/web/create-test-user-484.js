// Set DATABASE_URL explicitly for SQLite
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const email = 'feature-484-test@example.com';

    // Check if user exists by email (not clerkUserId)
    let user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      // Create user
      user = await prisma.user.create({
        data: {
          clerkUserId: email,
          email: email,
          isActive: true,
        },
      });
      console.log('✅ Created user:', email);
    } else {
      // Update clerkUserId to match email for dev auth
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkUserId: email },
      });
      console.log('ℹ️ User already exists, updated clerkUserId:', email);
    }

    // Check if onboarding state exists
    let onboardingState = await prisma.onboardingState.findUnique({
      where: { userId: user.id },
    });

    if (!onboardingState) {
      // Create onboarding state
      onboardingState = await prisma.onboardingState.create({
        data: {
          userId: user.id,
          completed: true,
          currentStep: 6, // Completed all 6 steps
        },
      });
      console.log('✅ Created onboarding state (completed)');
    } else {
      // Update to completed
      onboardingState = await prisma.onboardingState.update({
        where: { userId: user.id },
        data: { completed: true, currentStep: 6 },
      });
      console.log('✅ Updated onboarding state to completed');
    }

    // Create user profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Feature 484 Test User',
          biologicalSex: 'male',
          age: 30,
          heightCm: 178, // 5'10"
          weightKg: 79, // ~175 lbs
          goalType: 'maintain',
          goalKcal: 2100,
          activityLevel: 'moderate',
          trainingDays: JSON.stringify(['Monday', 'Wednesday', 'Friday']),
          dietaryStyle: 'omnivore',
          macroSplit: 'balanced',
          proteinTargetG: 160,
          carbsTargetG: 230,
          fatTargetG: 65,
          mealsPerDay: 3,
          snacksPerDay: 1,
          cookingSkill: 5,
          maxPrepTimeMin: 30,
          cuisinePreferences: JSON.stringify(['American', 'Italian']),
          isActive: true,
        },
      });
      console.log('✅ Created user profile');
    } else {
      console.log('ℹ️ Profile already exists');
    }

    // Verify no active meal plan exists
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true, status: 'active' },
    });

    if (activePlan) {
      console.log('⚠️ User has an active meal plan - deactivating it');
      await prisma.mealPlan.update({
        where: { id: activePlan.id },
        data: { isActive: false },
      });
    } else {
      console.log('✅ Confirmed: No active meal plan');
    }

    console.log('\n✅ Test user setup complete!');
    console.log('Email:', email);
    console.log('User ID:', user.id);
    console.log('Onboarding: Completed ✅');
    console.log('Profile: Created ✅');
    console.log('Meal Plan: None ✅');
    console.log('\nYou can now sign in and navigate to /dashboard to see the empty state.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
