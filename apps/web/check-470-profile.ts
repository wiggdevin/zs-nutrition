import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Profile Data for Feature 470 Test ===\n');

  const profile = await prisma.userProfile.findFirst({
    where: {
      OR: [
        { user: { clerkUserId: { contains: '470' } } },
        { name: { contains: '470' } },
      ],
    },
  });

  if (profile) {
    console.log('Profile found:');
    console.log('  Name:', profile.name);
    console.log('  Activity Level:', profile.activityLevel);
    console.log('  Training Days:', profile.trainingDays);
    console.log('  BMR:', profile.bmrKcal, 'kcal');
    console.log('  TDEE:', profile.tdeeKcal, 'kcal');
    console.log('  Goal Calories:', profile.goalKcal, 'kcal');
    console.log('  Protein Target:', profile.proteinTargetG, 'g');
    console.log('  Carbs Target:', profile.carbsTargetG, 'g');
    console.log('  Fat Target:', profile.fatTargetG, 'g');

    console.log('\n--- Verification ---');

    // Calculate expected TDEE for "very_active"
    const expectedBMR = 1618; // For male, 30yo, 170cm, 70kg
    const multiplier = profile.activityLevel === 'very_active' ? 1.725 : 1.55;
    const expectedTDEE = Math.round(expectedBMR * multiplier);

    console.log('Expected TDEE for', profile.activityLevel, '(' + multiplier + '):', expectedTDEE, 'kcal');
    console.log('Actual TDEE in DB:', profile.tdeeKcal, 'kcal');

    if (profile.tdeeKcal === expectedTDEE) {
      console.log('✅ TDEE RECALCULATED CORRECTLY!');
    } else {
      console.log('❌ TDEE mismatch - recalculation may not have occurred');
    }

    // Check training days
    const trainingDays = JSON.parse(profile.trainingDays || '[]');
    console.log('\nTraining Days:', trainingDays);
    if (trainingDays.length === 5 &&
        trainingDays.includes('monday') &&
        trainingDays.includes('tuesday') &&
        trainingDays.includes('wednesday') &&
        trainingDays.includes('thursday') &&
        trainingDays.includes('friday')) {
      console.log('✅ Training days updated correctly (Mon, Tue, Wed, Thu, Fri)');
    } else {
      console.log('❌ Training days not as expected');
    }

    // Check training bonus (should be 300 for very_active)
    console.log('\nTraining bonus should be 300 kcal for very_active');
    console.log('Calculated training bonus from TDEE:', profile.tdeeKcal - profile.bmrKcal, 'kcal above BMR');
  } else {
    console.log('No profile found for test user 470');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
