// Test script for Feature #112: Agent 2 calculates TDEE with activity multiplier
import { MetabolicCalculator } from './dist/agents/metabolic-calculator.js';

const calculator = new MetabolicCalculator();

// Helper to create a standard intake with a specific activity level
function makeIntake(activityLevel, overrides = {}) {
  return {
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 177.8,
    weightKg: 77.1,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel,
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
    ...overrides,
  };
}

console.log('=== Feature #112: Agent 2 TDEE with Activity Multiplier ===\n');

let allPass = true;

// First, compute the BMR for our test user to use as reference
// Male: 10 * 77.1 + 6.25 * 177.8 - 5 * 30 + 5 = 771 + 1111.25 - 150 + 5 = 1737.25 -> 1737
const expectedBmr = Math.round(10 * 77.1 + 6.25 * 177.8 - 5 * 30 + 5);
console.log(`Reference BMR for test user: ${expectedBmr}\n`);

// --- Test 1: BMR=1780, activityLevel=moderately_active -> TDEE = 1780 * 1.55 = 2759 ---
// The feature says BMR=1780, so we need to find inputs that give BMR=1780.
// For a male: BMR = 10*w + 6.25*h - 5*a + 5
// 1780 = 10*w + 6.25*h - 5*a + 5
// Let's use age=25, height=175, then: 1780 = 10*w + 1093.75 - 125 + 5 = 10*w + 973.75
// w = (1780 - 973.75)/10 = 80.625
// BMR = 10*80.625 + 6.25*175 - 5*25 + 5 = 806.25 + 1093.75 - 125 + 5 = 1780
const intake1780 = makeIntake('moderately_active', {
  age: 25,
  heightCm: 175,
  weightKg: 80.625,
});
const result1 = calculator.calculate(intake1780);
const expectedTdee1 = Math.round(1780 * 1.55); // 2759
console.log(`Test 1: BMR=1780, moderately_active (1.55)`);
console.log(`  BMR: ${result1.bmrKcal} (expected 1780)`);
console.log(`  TDEE: ${result1.tdeeKcal} (expected ${expectedTdee1})`);
const pass1 = result1.bmrKcal === 1780 && result1.tdeeKcal === expectedTdee1;
console.log(`  ${pass1 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass1) allPass = false;

// --- Test 2: sedentary (1.2) ---
const intakeSedentary = makeIntake('sedentary', {
  age: 25,
  heightCm: 175,
  weightKg: 80.625,
});
const result2 = calculator.calculate(intakeSedentary);
const expectedTdee2 = Math.round(1780 * 1.2); // 2136
console.log(`Test 2: BMR=1780, sedentary (1.2)`);
console.log(`  BMR: ${result2.bmrKcal} (expected 1780)`);
console.log(`  TDEE: ${result2.tdeeKcal} (expected ${expectedTdee2})`);
const pass2 = result2.bmrKcal === 1780 && result2.tdeeKcal === expectedTdee2;
console.log(`  ${pass2 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass2) allPass = false;

// --- Test 3: very_active (1.725) ---
const intakeVeryActive = makeIntake('very_active', {
  age: 25,
  heightCm: 175,
  weightKg: 80.625,
});
const result3 = calculator.calculate(intakeVeryActive);
const expectedTdee3 = Math.round(1780 * 1.725); // 3071 (1780 * 1.725 = 3070.5 -> 3071)
console.log(`Test 3: BMR=1780, very_active (1.725)`);
console.log(`  BMR: ${result3.bmrKcal} (expected 1780)`);
console.log(`  TDEE: ${result3.tdeeKcal} (expected ${expectedTdee3})`);
const pass3 = result3.bmrKcal === 1780 && result3.tdeeKcal === expectedTdee3;
console.log(`  ${pass3 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass3) allPass = false;

// --- Test 4: Verify all multipliers ---
const multipliers = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

console.log(`Test 4: Verify all activity multipliers`);
let pass4 = true;
for (const [level, mult] of Object.entries(multipliers)) {
  const intake = makeIntake(level, { age: 25, heightCm: 175, weightKg: 80.625 });
  const result = calculator.calculate(intake);
  const expectedTdee = Math.round(1780 * mult);
  const ok = result.bmrKcal === 1780 && result.tdeeKcal === expectedTdee;
  console.log(`  ${level}: TDEE=${result.tdeeKcal} (expected ${expectedTdee}) ${ok ? '✅' : '❌'}`);
  if (!ok) pass4 = false;
}
console.log(`  ${pass4 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass4) allPass = false;

// --- Summary ---
console.log('=== Summary ===');
console.log(`All tests: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
process.exit(allPass ? 0 : 1);
