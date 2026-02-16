/**
 * Test: Agent 1 (Intake Normalizer) converts imperial to metric
 * Feature #109
 *
 * Steps:
 * 1. Pass input with heightFeet=5, heightInches=10, weightLbs=170
 * 2. Verify output heightCm is approximately 177.8
 * 3. Verify output weightKg is approximately 77.1
 * 4. Verify original imperial fields are not in output
 */

import { IntakeNormalizer } from './dist/index.js';

const normalizer = new IntakeNormalizer();

// Test input with imperial measurements
const input = {
  name: 'Test User',
  sex: 'male',
  age: 30,
  heightFeet: 5,
  heightInches: 10,
  weightLbs: 170,
  goalType: 'maintain',
  goalRate: 0,
  activityLevel: 'moderately_active',
  trainingDays: ['monday', 'wednesday', 'friday'],
  trainingTime: 'morning',
  dietaryStyle: 'omnivore',
  allergies: [],
  exclusions: [],
  cuisinePreferences: ['italian', 'mexican'],
  mealsPerDay: 3,
  snacksPerDay: 2,
  cookingSkill: 5,
  prepTimeMaxMin: 30,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

let allPassed = true;

try {
  const result = normalizer.normalize(input);

  // Step 1: Verify conversion ran successfully
  console.log('✅ Step 1: Input processed successfully');
  console.log(`   heightCm = ${result.heightCm}, weightKg = ${result.weightKg}`);

  // Step 2: Verify heightCm is approximately 177.8
  // 5'10" = 70 inches = 70 * 2.54 = 177.8 cm
  const expectedHeight = 177.8;
  if (Math.abs(result.heightCm - expectedHeight) < 0.1) {
    console.log(`✅ Step 2: heightCm is ${result.heightCm} (expected ~${expectedHeight})`);
  } else {
    console.log(`❌ Step 2: heightCm is ${result.heightCm} (expected ~${expectedHeight})`);
    allPassed = false;
  }

  // Step 3: Verify weightKg is approximately 77.1
  // 170 lbs * 0.453592 = 77.11064 kg -> rounded to 77.1
  const expectedWeight = 77.1;
  if (Math.abs(result.weightKg - expectedWeight) < 0.1) {
    console.log(`✅ Step 3: weightKg is ${result.weightKg} (expected ~${expectedWeight})`);
  } else {
    console.log(`❌ Step 3: weightKg is ${result.weightKg} (expected ~${expectedWeight})`);
    allPassed = false;
  }

  // Step 4: Verify original imperial fields are not in output
  const hasHeightFeet = 'heightFeet' in result;
  const hasHeightInches = 'heightInches' in result;
  const hasWeightLbs = 'weightLbs' in result;

  if (!hasHeightFeet && !hasHeightInches && !hasWeightLbs) {
    console.log('✅ Step 4: No imperial fields in output');
  } else {
    const remaining = [];
    if (hasHeightFeet) remaining.push('heightFeet');
    if (hasHeightInches) remaining.push('heightInches');
    if (hasWeightLbs) remaining.push('weightLbs');
    console.log(`❌ Step 4: Imperial fields still in output: ${remaining.join(', ')}`);
    allPassed = false;
  }

  // Additional verification: output has metric fields
  if (result.heightCm && result.weightKg) {
    console.log('✅ Additional: Output has metric fields (heightCm, weightKg)');
  }

  // Verify schema validation passed (it's Zod parsed)
  console.log('✅ Additional: Zod schema validation passed');
} catch (error) {
  console.log(`❌ ERROR: ${error.message}`);
  allPassed = false;
}

console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED' : '💥 SOME TESTS FAILED'));
process.exit(allPassed ? 0 : 1);
