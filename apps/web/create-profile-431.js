const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { clerkUserId: 'test-user-431' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'test-user-431',
        email: 'test-431@example.com'
      }
    });
    console.log('Created user:', user.id);
  } else {
    console.log('Found user:', user.id);
  }

  // Create profile if doesn't exist
  const existingProfile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true }
  });

  if (existingProfile) {
    console.log('Profile already exists');
    console.log('Profile ID:', existingProfile.id);
  } else {
    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Test User 431',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 75,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']),
        dietaryStyle: 'omnivore',
        allergies: JSON.stringify([]),
        exclusions: JSON.stringify([]),
        cuisinePrefs: JSON.stringify(['Italian', 'Mexican', 'Asian']),
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        bmrKcal: 1750,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 67,
        isActive: true
      }
    });
    console.log('Created profile:', profile.id);
  }

  // Get the active meal plan
  const activePlan = await prisma.mealPlan.findFirst({
    where: { status: 'active' }
  });

  if (activePlan && activePlan.userId !== user.id) {
    // Update plan to belong to test user
    await prisma.mealPlan.update({
      where: { id: activePlan.id },
      data: {
        userId: user.id,
        profileId: existingProfile?.id || profile.id
      }
    });
    console.log('Updated meal plan to belong to test user');
  }

  console.log('\nTest setup complete!');
  console.log('User ID:', user.id);
  console.log('Email: test-user-431');
  console.log('You can now sign in at: http://localhost:3000/dev-signin');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
