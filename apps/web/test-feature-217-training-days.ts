/**
 * Test script for Feature #217: Meal plan generated with correct targets per day type
 *
 * Creates a test user with:
 * - Training days: Monday, Wednesday, Friday (3 days/week)
 * - Activity level: moderately_active (200 kcal bonus)
 * - Goal: 2000 kcal base
 *
 * Expected behavior:
 * - Training days (Mon, Wed, Fri): 2200 kcal (2000 + 200 bonus)
 * - Rest days (Tue, Thu, Sat, Sun): 2000 kcal
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  const TEST_EMAIL = 'feature-217-test@zsmac.dev';
  const TEST_CLERK_ID = 'feature_217_test_clerk_id';

  console.log('=== Feature #217 Test Setup ===\n');

  // 1. Clean up any existing test data
  console.log('Step 1: Cleaning up existing test data...');
  await prisma.trackedMeal.deleteMany({
    where: { userId: TEST_CLERK_ID }
  });

  await prisma.dailyLog.deleteMany({
    where: { userId: TEST_CLERK_ID }
  });

  await prisma.mealPlan.deleteMany({
    where: { userId: TEST_CLERK_ID }
  });

  await prisma.onboardingState.deleteMany({
    where: { userId: TEST_CLERK_ID }
  });

  await prisma.userProfile.deleteMany({
    where: { userId: TEST_CLERK_ID }
  });

  await prisma.user.deleteMany({
    where: { clerkUserId: TEST_CLERK_ID }
  });

  console.log('✓ Cleanup complete\n');

  // 2. Create test user
  console.log('Step 2: Creating test user...');
  const user = await prisma.user.create({
    data: {
      clerkUserId: TEST_CLERK_ID,
      email: TEST_EMAIL,
    }
  });
  console.log(`✓ User created: ${user.id}\n`);

  // 3. Create user profile with training days
  console.log('Step 3: Creating profile with training days...');
  const profile = await prisma.userProfile.create({
    data: {
      userId: user.id,
      name: 'Feature 217 Test User',
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'moderately_active',
      dietaryStyle: 'omnivore',
      allergies: JSON.stringify([]),
      exclusions: JSON.stringify([]),
      cuisinePrefs: JSON.stringify(['italian', 'mexican', 'american']),
      trainingDays: JSON.stringify(['monday', 'wednesday', 'friday']), // 3 training days
      trainingTime: 'morning',
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 7,
      prepTimeMax: 45,
      macroStyle: 'balanced',
      isActive: true,
      // Cached metabolic values
      bmrKcal: 1800,
      tdeeKcal: 2500,
      goalKcal: 2000, // Base goal
      proteinTargetG: 150,
      carbsTargetG: 200,
      fatTargetG: 67,
    }
  });
  console.log(`✓ Profile created: ${profile.id}`);
  const trainingDaysParsed = JSON.parse(profile.trainingDays);
  console.log(`  Training days: ${trainingDaysParsed.join(', ')}`);
  console.log(`  Activity level: ${profile.activityLevel}`);
  console.log(`  Base calories: ${profile.goalKcal} kcal\n`);

  // 4. Generate a meal plan using the nutrition engine
  console.log('Step 4: Generating meal plan...');
  const { IntakeNormalizer } = await import('../../packages/nutrition-engine/src/agents/intake-normalizer');
  const { MetabolicCalculator } = await import('../../packages/nutrition-engine/src/agents/metabolic-calculator');
  const { RecipeCurator } = await import('../../packages/nutrition-engine/src/agents/recipe-curator');

  // Create raw intake form
  const rawIntake = {
    name: profile.name,
    sex: profile.sex as 'male' | 'female',
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goalType: profile.goalType as 'cut' | 'maintain' | 'bulk',
    goalRate: profile.goalRate,
    activityLevel: profile.activityLevel as any,
    trainingDays: JSON.parse(profile.trainingDays) as any[],
    trainingTime: profile.trainingTime as any,
    dietaryStyle: profile.dietaryStyle as any,
    allergies: JSON.parse(profile.allergies),
    exclusions: JSON.parse(profile.exclusions),
    cuisinePreferences: JSON.parse(profile.cuisinePrefs),
    mealsPerDay: profile.mealsPerDay,
    snacksPerDay: profile.snacksPerDay,
    cookingSkill: profile.cookingSkill,
    prepTimeMaxMin: profile.prepTimeMax,
    macroStyle: profile.macroStyle as any,
    planDurationDays: 7,
  };

  // Run the pipeline
  const normalizer = new IntakeNormalizer();
  const intake = normalizer.normalize(rawIntake);

  const calculator = new MetabolicCalculator();
  const metabolic = calculator.calculate(intake);

  console.log(`\nMetabolic Profile:`);
  console.log(`  Base calories (goalKcal): ${metabolic.goalKcal}`);
  console.log(`  Rest day calories: ${metabolic.restDayKcal}`);
  console.log(`  Training day bonus: ${metabolic.trainingDayBonusKcal}`);
  console.log(`  Training day total: ${metabolic.goalKcal + metabolic.trainingDayBonusKcal} kcal\n`);

  const curator = new RecipeCurator(process.env.ANTHROPIC_API_KEY || '');
  const draft = await curator.generate(metabolic, intake);

  // Check each day's target
  console.log('Day targets in generated draft:');
  for (const day of draft.days) {
    const expectedKcal = day.isTrainingDay
      ? metabolic.goalKcal + metabolic.trainingDayBonusKcal
      : metabolic.restDayKcal;

    const match = day.targetKcal === expectedKcal ? '✓' : '✗';
    console.log(`  ${match} Day ${day.dayNumber} (${day.dayName}): ${day.targetKcal} kcal ` +
                `[Training: ${day.isTrainingDay}, Expected: ${expectedKcal}]`);
  }
  console.log();

  // 5. Save meal plan to database
  console.log('Step 5: Saving meal plan to database...');
  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      validatedPlan: JSON.stringify(draft),
      metabolicProfile: JSON.stringify(metabolic),
      dailyKcalTarget: metabolic.goalKcal,
      dailyProteinG: metabolic.proteinTargetG,
      dailyCarbsG: metabolic.carbsTargetG,
      dailyFatG: metabolic.fatTargetG,
      trainingBonusKcal: metabolic.trainingDayBonusKcal,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 95,
      qaStatus: 'PASS',
      status: 'active',
      isActive: true,
      generatedAt: new Date(),
    }
  });
  console.log(`✓ Meal plan created: ${mealPlan.id}\n`);

  // 6. Verification summary
  console.log('=== Verification Summary ===');
  console.log(`Test user email: ${TEST_EMAIL}`);
  console.log(`Test user clerk ID: ${TEST_CLERK_ID}`);
  console.log(`Profile ID: ${profile.id}`);
  console.log(`Meal Plan ID: ${mealPlan.id}`);
  console.log();

  const trainingDayKcal = metabolic.goalKcal + metabolic.trainingDayBonusKcal;
  console.log('Expected behavior:');
  console.log(`  Training days (Mon, Wed, Fri): ${trainingDayKcal} kcal`);
  console.log(`  Rest days (Tue, Thu, Sat, Sun): ${metabolic.restDayKcal} kcal`);
  console.log();

  // Verify the draft has correct targets
  let allCorrect = true;
  for (const day of draft.days) {
    const expected = day.isTrainingDay
      ? metabolic.goalKcal + metabolic.trainingDayBonusKcal
      : metabolic.restDayKcal;

    if (day.targetKcal !== expected) {
      console.error(`ERROR: Day ${day.dayNumber} has ${day.targetKcal} kcal, expected ${expected}`);
      allCorrect = false;
    }
  }

  if (allCorrect) {
    console.log('✓ All day targets are correct!');
  } else {
    console.log('✗ Some day targets are incorrect!');
  }

  console.log('\nTest setup complete!');
  console.log('Next steps:');
  console.log('1. Navigate to meal plan page');
  console.log('2. Verify each day shows correct calorie target');
  console.log('3. Check that training days show bonus calories');

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error);
    process.exit(1);
  });
