// Test script for Feature #109: Agent 1 (Intake Normalizer) converts imperial to metric
import { IntakeNormalizer } from './dist/agents/intake-normalizer.js';

const normalizer = new IntakeNormalizer();

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
  cuisinePreferences: ['american'],
  mealsPerDay: 3,
  snacksPerDay: 1,
  cookingSkill: 5,
  prepTimeMaxMin: 30,
  macroStyle: 'balanced',
  planDurationDays: 7,
};

console.log('=== Feature #109: Agent 1 Imperial to Metric Conversion ===\n');
console.log(
  'Input:',
  JSON.stringify(
    { heightFeet: input.heightFeet, heightInches: input.heightInches, weightLbs: input.weightLbs },
    null,
    2
  )
);

try {
  const result = normalizer.normalize(input);

  console.log('\nOutput:', JSON.stringify(result, null, 2));

  // Test 1: heightCm approximately 177.8
  const expectedHeight = 177.8;
  const heightPass = Math.abs(result.heightCm - expectedHeight) < 0.1;
  console.log(
    `\n✅ Test 1: heightCm = ${result.heightCm} (expected ~${expectedHeight}) - ${heightPass ? 'PASS' : 'FAIL'}`
  );

  // Test 2: weightKg approximately 77.1
  const expectedWeight = 77.1;
  const weightPass = Math.abs(result.weightKg - expectedWeight) < 0.1;
  console.log(
    `✅ Test 2: weightKg = ${result.weightKg} (expected ~${expectedWeight}) - ${weightPass ? 'PASS' : 'FAIL'}`
  );

  // Test 3: Original imperial fields not in output
  const hasHeightFeet = 'heightFeet' in result;
  const hasHeightInches = 'heightInches' in result;
  const hasWeightLbs = 'weightLbs' in result;
  const noImperial = !hasHeightFeet && !hasHeightInches && !hasWeightLbs;
  console.log(
    `✅ Test 3: No imperial fields in output - heightFeet: ${hasHeightFeet}, heightInches: ${hasHeightInches}, weightLbs: ${hasWeightLbs} - ${noImperial ? 'PASS' : 'FAIL'}`
  );

  const allPass = heightPass && weightPass && noImperial;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Overall: ${allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);

  if (!allPass) process.exit(1);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
