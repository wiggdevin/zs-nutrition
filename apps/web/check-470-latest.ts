import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Latest Profile Data for Feature 470 Test ===\n');

  // Get the most recently updated profile
  const profile = await prisma.userProfile.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (profile) {
    console.log('Most recent profile:');
    console.log('  ID:', profile.id);
    console.log('  Name:', profile.name);
    console.log('  Activity Level:', profile.activityLevel);
    console.log('  Training Days:', profile.trainingDays);
    console.log('  Updated At:', profile.updatedAt);
    console.log('\nMetabolic Data:');
    console.log('  BMR:', profile.bmrKcal, 'kcal');
    console.log('  TDEE:', profile.tdeeKcal, 'kcal');
    console.log('  Goal Calories:', profile.goalKcal, 'kcal');
    console.log('  Protein Target:', profile.proteinTargetG, 'g');
    console.log('  Carbs Target:', profile.carbsTargetG, 'g');
    console.log('  Fat Target:', profile.fatTargetG, 'g');

    console.log('\n--- Verification ---');

    // Parse training days
    const trainingDays = JSON.parse(profile.trainingDays || '[]');
    console.log('\nTraining Days:', trainingDays);
    console.log('Expected: ["monday", "tuesday", "wednesday", "thursday", "friday"]');

    if (trainingDays.length === 5 &&
        trainingDays.includes('monday') &&
        trainingDays.includes('tuesday') &&
        trainingDays.includes('wednesday') &&
        trainingDays.includes('thursday') &&
        trainingDays.includes('friday')) {
      console.log('✅ Training days updated correctly (Mon-Fri)');
    } else {
      console.log('❌ Training days not as expected');
      console.log('   Got:', trainingDays);
    }

    // Calculate expected TDEE for very_active
    const multiplier = profile.activityLevel === 'very_active' ? 1.725 :
                       profile.activityLevel === 'moderately_active' ? 1.55 :
                       profile.activityLevel === 'lightly_active' ? 1.375 :
                       profile.activityLevel === 'sedentary' ? 1.2 : 1.9;

    const expectedTDEE = profile.bmrKcal ? Math.round(profile.bmrKcal * multiplier) : 0;

    console.log('\nActivity Level:', profile.activityLevel);
    console.log('Multiplier:', multiplier);
    console.log('Expected TDEE:', expectedTDEE, 'kcal');
    console.log('Actual TDEE in DB:', profile.tdeeKcal, 'kcal');

    if (profile.tdeeKcal === expectedTDEE) {
      console.log('✅ TDEE RECALCULATED CORRECTLY with new multiplier!');
    } else {
      console.log('❌ TDEE mismatch');
      console.log('   Difference:', (profile.tdeeKcal || 0) - expectedTDEE, 'kcal');
    }

    // Check if activity level changed
    if (profile.activityLevel === 'very_active') {
      console.log('\n✅ Activity level changed to very_active');
    } else {
      console.log('\n❌ Activity level is not very_active:', profile.activityLevel);
    }

  } else {
    console.log('No profile found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
