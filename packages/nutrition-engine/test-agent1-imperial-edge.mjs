/**
 * Additional edge case tests for Agent 1 imperial conversion
 */
import { IntakeNormalizer } from './dist/index.js';

const normalizer = new IntakeNormalizer();

const baseInput = {
  name: 'Test User',
  sex: 'male',
  age: 25,
  goalType: 'cut',
  goalRate: 1,
  activityLevel: 'very_active',
  trainingDays: ['monday', 'friday'],
  dietaryStyle: 'omnivore',
  allergies: [],
  exclusions: [],
  cuisinePreferences: [],
  mealsPerDay: 3,
  snacksPerDay: 1,
  cookingSkill: 7,
  prepTimeMaxMin: 45,
  macroStyle: 'high_protein',
  planDurationDays: 7,
};

let allPassed = true;

// Test 1: Metric input passes through unchanged
try {
  const result = normalizer.normalize({ ...baseInput, heightCm: 180, weightKg: 80 });
  if (result.heightCm === 180 && result.weightKg === 80) {
    console.log('✅ Metric passthrough: heightCm=180, weightKg=80');
  } else {
    console.log(`❌ Metric passthrough failed: got ${result.heightCm}, ${result.weightKg}`);
    allPassed = false;
  }
} catch (e) {
  console.log(`❌ Metric passthrough error: ${e.message}`);
  allPassed = false;
}

// Test 2: Different imperial values - 6'0" = 182.88 cm
try {
  const result = normalizer.normalize({
    ...baseInput,
    heightFeet: 6,
    heightInches: 0,
    weightLbs: 200,
  });
  const expectedH = 182.9; // 72 * 2.54 = 182.88 -> 182.9
  const expectedW = 90.7; // 200 * 0.453592 = 90.7184 -> 90.7
  if (Math.abs(result.heightCm - expectedH) < 0.1 && Math.abs(result.weightKg - expectedW) < 0.1) {
    console.log(`✅ 6'0" 200lbs: heightCm=${result.heightCm}, weightKg=${result.weightKg}`);
  } else {
    console.log(
      `❌ 6'0" 200lbs: got heightCm=${result.heightCm} (exp ~${expectedH}), weightKg=${result.weightKg} (exp ~${expectedW})`
    );
    allPassed = false;
  }
} catch (e) {
  console.log(`❌ 6'0" test error: ${e.message}`);
  allPassed = false;
}

// Test 3: No imperial fields in output for imperial input
try {
  const result = normalizer.normalize({
    ...baseInput,
    heightFeet: 5,
    heightInches: 5,
    weightLbs: 130,
  });
  const keys = Object.keys(result);
  const imperialKeys = keys.filter((k) =>
    ['heightFeet', 'heightInches', 'weightLbs', 'heightCm_orig', 'weightKg_orig'].includes(k)
  );
  if (imperialKeys.length === 0 && keys.includes('heightCm') && keys.includes('weightKg')) {
    console.log('✅ Output contains only metric fields, no imperial fields');
  } else {
    console.log(`❌ Found unexpected keys: ${imperialKeys.join(', ')}`);
    allPassed = false;
  }
} catch (e) {
  console.log(`❌ Output fields test error: ${e.message}`);
  allPassed = false;
}

// Test 4: Missing both height formats throws error
try {
  normalizer.normalize({ ...baseInput, weightKg: 80 });
  console.log('❌ Expected error for missing height');
  allPassed = false;
} catch (e) {
  if (e.message.includes('Height must be provided')) {
    console.log('✅ Correctly throws error when no height provided');
  } else {
    console.log(`❌ Wrong error: ${e.message}`);
    allPassed = false;
  }
}

console.log('\n' + (allPassed ? '🎉 ALL EDGE CASE TESTS PASSED' : '💥 SOME TESTS FAILED'));
process.exit(allPassed ? 0 : 1);
