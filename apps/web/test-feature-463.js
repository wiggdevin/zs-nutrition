const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db',
    },
  },
});

async function main() {
  const userId = '8b1b3751-5d1d-46a5-bdea-b7c2efb950ba';

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profiles: { where: { isActive: true } } },
  });

  if (!user) {
    console.log('Creating user...');
    user = await prisma.user.create({
      data: {
        id: userId,
        clerkUserId: 'dev-user-463',
        email: 'dev-463@example.com',
        isActive: true,
      },
    });
    console.log('Created user:', user.id);
  } else {
    console.log('User exists:', user.id);
  }

  // Check for active profile
  let profile = user.profiles[0];
  if (!profile) {
    console.log('Creating profile...');
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Feature 463 Test User',
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
        isActive: true,
      },
    });
    console.log('Created profile:', profile.id);
  } else {
    console.log('Profile exists:', profile.id);
  }

  // Clean up any existing meal plans for this user
  const existingPlans = await prisma.mealPlan.findMany({
    where: { userId: user.id },
  });

  if (existingPlans.length > 0) {
    console.log(`Deleting ${existingPlans.length} existing meal plans...`);
    await prisma.mealPlan.deleteMany({
      where: { userId: user.id },
    });
    console.log('Deleted existing plans');
  }

  console.log('\nSetup complete!');
  console.log('User ID:', user.id);
  console.log('Profile ID:', profile.id);
  console.log('Ready to test Feature #463');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
