const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  // Find the test meal plan we just created
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      user: {
        email: 'feature-217-test@zsmac.dev'
      }
    },
    include: {
      user: true
    }
  });

  if (!mealPlan) {
    console.log('No meal plan found for feature-217-test@zsmac.dev');
    process.exit(1);
  }

  console.log('=== Meal Plan Found ===');
  console.log('ID:', mealPlan.id);
  console.log('User:', mealPlan.user.email);
  console.log('Clerk ID:', mealPlan.user.clerkUserId);
  console.log('Base calories:', mealPlan.dailyKcalTarget);
  console.log('Training bonus:', mealPlan.trainingBonusKcal);
  console.log();

  const validatedPlan = JSON.parse(mealPlan.validatedPlan);
  console.log('Days in plan:');
  for (const day of validatedPlan.days) {
    const expected = day.isTrainingDay
      ? mealPlan.dailyKcalTarget + mealPlan.trainingBonusKcal
      : mealPlan.dailyKcalTarget;

    const match = day.targetKcal === expected ? '✓' : '✗';
    console.log(`  ${match} ${day.dayName}: ${day.targetKcal} kcal [Training: ${day.isTrainingDay}, Expected: ${expected}]`);
  }

  console.log('\nUse these credentials to sign in:');
  console.log('  Email: feature-217-test@zsmac.dev');
  console.log('  Clerk ID: feature_217_test_clerk_id');
  console.log('\nThen navigate to /meal-plan to verify');

  await prisma.$disconnect();
}

main().catch(console.error);
