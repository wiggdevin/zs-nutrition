/**
 * Check the keto profile data in the database for Feature #480
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkKetoProfile() {
  console.log('='.repeat(60));
  console.log('Checking Keto Profile for Feature #480');
  console.log('='.repeat(60));
  console.log();

  try {
    // Find the test user
    const user = await prisma.user.findFirst({
      where: {
        email: 'feature-480-keto-test@example.com'
      },
      include: {
        profiles: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.email);
    console.log();

    if (!user.profiles || user.profiles.length === 0) {
      console.log('❌ No profile found');
      return;
    }

    const p = user.profiles[0];
    console.log('PROFILE DATA:');
    console.log('-'.repeat(60));
    console.log('Name:', p.name);
    console.log('Sex:', p.sex);
    console.log('Age:', p.age);
    console.log('Height:', p.heightCm, 'cm');
    console.log('Weight:', p.weightKg, 'kg');
    console.log('Activity Level:', p.activityLevel);
    console.log('Goal Type:', p.goalType);
    console.log('Macro Style:', p.macroStyle);
    console.log();
    console.log('CALCULATED METABOLIC DATA:');
    console.log('-'.repeat(60));
    console.log('BMR:', p.bmrKcal, 'kcal');
    console.log('TDEE:', p.tdeeKcal, 'kcal');
    console.log('Goal Calories:', p.goalKcal, 'kcal');
    console.log();
    console.log('MACRO TARGETS:');
    console.log('-'.repeat(60));
    console.log('Protein:', p.proteinTargetG, 'g');
    console.log('Carbs:', p.carbsTargetG, 'g');
    console.log('Fat:', p.fatTargetG, 'g');
    console.log();

    // Calculate percentages
    const proteinKcal = p.proteinTargetG * 4;
    const carbsKcal = p.carbsTargetG * 4;
    const fatKcal = p.fatTargetG * 9;
    const totalKcal = proteinKcal + carbsKcal + fatKcal;

    console.log('CALCULATED MACRO PERCENTAGES:');
    console.log('-'.repeat(60));
    console.log('Protein:', (proteinKcal / p.goalKcal * 100).toFixed(1) + '%');
    console.log('Carbs:', (carbsKcal / p.goalKcal * 100).toFixed(1) + '%');
    console.log('Fat:', (fatKcal / p.goalKcal * 100).toFixed(1) + '%');
    console.log();

    // Expected keto split
    console.log('EXPECTED KETO SPLIT:');
    console.log('-'.repeat(60));
    console.log('Protein: 30.0%');
    console.log('Carbs: 5.0%');
    console.log('Fat: 65.0%');
    console.log();

    // Verify
    console.log('VERIFICATION:');
    console.log('-'.repeat(60));
    const proteinPercent = proteinKcal / p.goalKcal;
    const carbsPercent = carbsKcal / p.goalKcal;
    const fatPercent = fatKcal / p.goalKcal;

    const proteinMatch = Math.abs(proteinPercent - 0.30) < 0.01;
    const carbsMatch = Math.abs(carbsPercent - 0.05) < 0.01;
    const fatMatch = Math.abs(fatPercent - 0.65) < 0.01;

    console.log('Protein match:', proteinMatch ? '✅' : '❌', (proteinPercent * 100).toFixed(1) + '% vs 30.0%');
    console.log('Carbs match:', carbsMatch ? '✅' : '❌', (carbsPercent * 100).toFixed(1) + '% vs 5.0%');
    console.log('Fat match:', fatMatch ? '✅' : '❌', (fatPercent * 100).toFixed(1) + '% vs 65.0%');
    console.log();

    if (proteinMatch && carbsMatch && fatMatch) {
      console.log('✅ KETO MACRO SPLIT IS CORRECT!');
    } else {
      console.log('❌ KETO MACRO SPLIT DOES NOT MATCH EXPECTED VALUES!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkKetoProfile();
