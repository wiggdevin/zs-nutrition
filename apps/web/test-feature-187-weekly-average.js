/**
 * Test script for Feature #187: Weekly adherence average displays
 * Creates a user with adherence scores across multiple days to test weekly average calculation
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db',
    },
  },
});

async function main() {
  console.log('🔧 Creating test data for Feature #187 (Weekly Average)...');

  const testEmail = 'feature-187-test@zsmac.dev';
  const clerkUserId = 'test_clerk_user_187';

  // Create or update user
  const user = await prisma.user.upsert({
    where: { clerkUserId },
    update: { isActive: true },
    create: {
      clerkUserId,
      email: testEmail,
      isActive: true,
    },
  });
  console.log('✅ User created:', user.email, `(ID: ${user.id})`);

  // Create profile
  await prisma.userProfile.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });

  const profile = await prisma.userProfile.create({
    data: {
      userId: user.id,
      name: 'Feature 187 Test User',
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']),
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMax: 30,
      macroStyle: 'balanced',
      dietaryStyle: 'omnivore',
      allergies: JSON.stringify([]),
      exclusions: JSON.stringify([]),
      cuisinePrefs: JSON.stringify([]),
      bmrKcal: 2000,
      tdeeKcal: 2700,
      goalKcal: 2500,
      proteinTargetG: 150,
      carbsTargetG: 250,
      fatTargetG: 80,
      isActive: true,
    },
  });
  console.log('✅ Profile created');

  // Complete onboarding
  await prisma.onboardingState.upsert({
    where: { userId: user.id },
    update: { completed: true },
    create: {
      userId: user.id,
      currentStep: 6,
      completed: true,
    },
  });
  console.log('✅ Onboarding complete');

  // Create daily logs for the past 7 days with varying adherence scores
  const today = new Date();

  // Day 1 (Today): 90% adherence (green)
  const day1 = new Date(today);
  day1.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day1, 90, 'Day 1 (Today)');

  // Day 2: 75% adherence (yellow)
  const day2 = new Date(today);
  day2.setDate(day2.getDate() - 1);
  day2.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day2, 75, 'Day 2');

  // Day 3: 85% adherence (green)
  const day3 = new Date(today);
  day3.setDate(day3.getDate() - 2);
  day3.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day3, 85, 'Day 3');

  // Day 4: 45% adherence (red)
  const day4 = new Date(today);
  day4.setDate(day4.getDate() - 3);
  day4.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day4, 45, 'Day 4');

  // Day 5: 95% adherence (green)
  const day5 = new Date(today);
  day5.setDate(day5.getDate() - 4);
  day5.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day5, 95, 'Day 5');

  // Day 6: 60% adherence (yellow)
  const day6 = new Date(today);
  day6.setDate(day6.getDate() - 5);
  day6.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day6, 60, 'Day 6');

  // Day 7: 80% adherence (green)
  const day7 = new Date(today);
  day7.setDate(day7.getDate() - 6);
  day7.setHours(0, 0, 0, 0);
  await createDailyLog(user.id, day7, 80, 'Day 7');

  console.log('\n📊 Weekly Adherence Scores Created:');
  console.log('  Day 1 (Today):    90% (green)');
  console.log('  Day 2:            75% (yellow)');
  console.log('  Day 3:            85% (green)');
  console.log('  Day 4:            45% (red)');
  console.log('  Day 5:            95% (green)');
  console.log('  Day 6:            60% (yellow)');
  console.log('  Day 7:            80% (green)');
  console.log('');
  console.log('  ➡️  Expected Weekly Average: 75.7% ≈ 76% (yellow)');

  console.log('\n🎉 Test data created for Feature #187!');
  console.log('📧 Sign in with:', testEmail);
}

async function createDailyLog(userId, date, adherenceScore, dayLabel) {
  // Calculate actuals based on adherence (targets are constant)
  // adherenceScore = (actualKcal / targetKcal) * 100 for simplicity
  const targetKcal = 2500;
  const targetProteinG = 150;
  const targetCarbsG = 250;
  const targetFatG = 80;

  const adherenceRatio = adherenceScore / 100;
  const actualKcal = Math.round(targetKcal * adherenceRatio);
  const actualProteinG = Math.round(targetProteinG * adherenceRatio);
  const actualCarbsG = Math.round(targetCarbsG * adherenceRatio);
  const actualFatG = Math.round(targetFatG * adherenceRatio);

  const dailyLog = await prisma.dailyLog.upsert({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    update: {
      targetKcal,
      targetProteinG,
      targetCarbsG,
      targetFatG,
      actualKcal,
      actualProteinG,
      actualCarbsG,
      actualFatG,
      adherenceScore,
      mealCount: Math.ceil(adherenceRatio * 4), // 0-4 meals based on adherence
    },
    create: {
      userId,
      date,
      targetKcal,
      targetProteinG,
      targetCarbsG,
      targetFatG,
      actualKcal,
      actualProteinG,
      actualCarbsG,
      actualFatG,
      adherenceScore,
      mealCount: Math.ceil(adherenceRatio * 4),
    },
  });

  // Delete existing meals for this day
  await prisma.trackedMeal.deleteMany({
    where: { userId, loggedDate: date },
  });

  // Create tracked meals (1-4 meals based on adherence)
  const mealCount = Math.ceil(adherenceRatio * 4);
  if (mealCount > 0) {
    const meals = [];
    const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'];

    for (let i = 0; i < mealCount; i++) {
      meals.push({
        userId,
        loggedDate: date,
        mealSlot: mealSlots[i],
        mealName: `TEST_187_MEAL_${dayLabel.replace(' ', '_').toUpperCase()}_${i + 1}`,
        portion: 1.0,
        kcal: Math.round(actualKcal / mealCount),
        proteinG: Math.round(actualProteinG / mealCount),
        carbsG: Math.round(actualCarbsG / mealCount),
        fatG: Math.round(actualFatG / mealCount),
        fiberG: 0,
        source: 'manual_entry',
        confidenceScore: 1.0,
      });
    }

    await prisma.trackedMeal.createMany({ data: meals });
  }

  console.log(`✅ ${dayLabel}: ${adherenceScore}% adherence (${actualKcal}/${targetKcal} kcal)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
