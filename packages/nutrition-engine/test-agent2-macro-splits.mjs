// Test script for Feature #114: Agent 2 calculates macro splits correctly
import { MetabolicCalculator } from './dist/agents/metabolic-calculator.js';

const calculator = new MetabolicCalculator();

// Helper to create a standard intake with a specific macro style
function makeIntake(macroStyle, goalKcal = 2000, overrides = {}) {
  // Find weight that gives us exactly the goalKcal for maintenance
  // For maintain mode, goalKcal = TDEE = BMR * multiplier (use sedentary 1.2 for simplicity)
  // BMR = goalKcal / 1.2
  // For male: BMR = 10*w + 6.25*h - 5*a + 5
  // Let's use: age=30, height=177.8 (5'10")
  // BMR = 10*w + 6.25*177.8 - 5*30 + 5 = 10*w + 1111.25 - 150 + 5 = 10*w + 966.25
  // For goalKcal=2000: BMR = 2000/1.2 = 1666.67
  // 1666.67 = 10*w + 966.25
  // 10*w = 700.42
  // w = 70.042

  const bmr = goalKcal / 1.2;
  const weightKg = (bmr - 966.25) / 10;

  return {
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 177.8,
    weightKg: Math.round(weightKg * 1000) / 1000,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'sedentary',
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
    macroStyle,
    planDurationDays: 7,
    ...overrides,
  };
}

console.log('=== Feature #114: Agent 2 Macro Split Calculations ===\n');

let allPass = true;

// Expected macro splits (percentage of calories)
const MACRO_SPLITS = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
  low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
  keto: { protein: 0.3, carbs: 0.05, fat: 0.65 },
};

// --- Test 1: Balanced split with goalKcal=2000 ---
console.log('Test 1: Balanced macro split (30/40/30) with goalKcal=2000');
const intake1 = makeIntake('balanced', 2000);
const result1 = calculator.calculate(intake1);

// Expected: protein = 2000 * 0.3 / 4 = 150g
//           carbs = 2000 * 0.4 / 4 = 200g
//           fat = 2000 * 0.3 / 9 = 66.67 -> 67g
const expectedProtein1 = Math.round((2000 * MACRO_SPLITS.balanced.protein) / 4);
const expectedCarbs1 = Math.round((2000 * MACRO_SPLITS.balanced.carbs) / 4);
const expectedFat1 = Math.round((2000 * MACRO_SPLITS.balanced.fat) / 9);

console.log(`  Goal Calories: ${result1.goalKcal} (expected 2000)`);
console.log(`  Protein: ${result1.proteinTargetG}g (expected ${expectedProtein1}g)`);
console.log(`  Carbs: ${result1.carbsTargetG}g (expected ${expectedCarbs1}g)`);
console.log(`  Fat: ${result1.fatTargetG}g (expected ${expectedFat1}g)`);
console.log(`  Macro Split: ${result1.macroSplit.proteinPercent}% / ${result1.macroSplit.carbsPercent}% / ${result1.macroSplit.fatPercent}%`);
const pass1 = result1.proteinTargetG === expectedProtein1 &&
              result1.carbsTargetG === expectedCarbs1 &&
              result1.fatTargetG === expectedFat1 &&
              result1.macroSplit.proteinPercent === 30 &&
              result1.macroSplit.carbsPercent === 40 &&
              result1.macroSplit.fatPercent === 30;
console.log(`  ${pass1 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass1) allPass = false;

// --- Test 2: High protein split (40/35/25) ---
console.log('Test 2: High protein macro split (40/35/25) with goalKcal=2000');
const intake2 = makeIntake('high_protein', 2000);
const result2 = calculator.calculate(intake2);

const expectedProtein2 = Math.round((2000 * MACRO_SPLITS.high_protein.protein) / 4);
const expectedCarbs2 = Math.round((2000 * MACRO_SPLITS.high_protein.carbs) / 4);
const expectedFat2 = Math.round((2000 * MACRO_SPLITS.high_protein.fat) / 9);

console.log(`  Goal Calories: ${result2.goalKcal} (expected 2000)`);
console.log(`  Protein: ${result2.proteinTargetG}g (expected ${expectedProtein2}g)`);
console.log(`  Carbs: ${result2.carbsTargetG}g (expected ${expectedCarbs2}g)`);
console.log(`  Fat: ${result2.fatTargetG}g (expected ${expectedFat2}g)`);
console.log(`  Macro Split: ${result2.macroSplit.proteinPercent}% / ${result2.macroSplit.carbsPercent}% / ${result2.macroSplit.fatPercent}%`);
const pass2 = result2.proteinTargetG === expectedProtein2 &&
              result2.carbsTargetG === expectedCarbs2 &&
              result2.fatTargetG === expectedFat2 &&
              result2.macroSplit.proteinPercent === 40 &&
              result2.macroSplit.carbsPercent === 35 &&
              result2.macroSplit.fatPercent === 25;
console.log(`  ${pass2 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass2) allPass = false;

// --- Test 3: Low carb split (35/25/40) ---
console.log('Test 3: Low carb macro split (35/25/40) with goalKcal=2000');
const intake3 = makeIntake('low_carb', 2000);
const result3 = calculator.calculate(intake3);

const expectedProtein3 = Math.round((2000 * MACRO_SPLITS.low_carb.protein) / 4);
const expectedCarbs3 = Math.round((2000 * MACRO_SPLITS.low_carb.carbs) / 4);
const expectedFat3 = Math.round((2000 * MACRO_SPLITS.low_carb.fat) / 9);

console.log(`  Goal Calories: ${result3.goalKcal} (expected 2000)`);
console.log(`  Protein: ${result3.proteinTargetG}g (expected ${expectedProtein3}g)`);
console.log(`  Carbs: ${result3.carbsTargetG}g (expected ${expectedCarbs3}g)`);
console.log(`  Fat: ${result3.fatTargetG}g (expected ${expectedFat3}g)`);
console.log(`  Macro Split: ${result3.macroSplit.proteinPercent}% / ${result3.macroSplit.carbsPercent}% / ${result3.macroSplit.fatPercent}%`);
const pass3 = result3.proteinTargetG === expectedProtein3 &&
              result3.carbsTargetG === expectedCarbs3 &&
              result3.fatTargetG === expectedFat3 &&
              result3.macroSplit.proteinPercent === 35 &&
              result3.macroSplit.carbsPercent === 25 &&
              result3.macroSplit.fatPercent === 40;
console.log(`  ${pass3 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass3) allPass = false;

// --- Test 4: Keto split (30/5/65) ---
console.log('Test 4: Keto macro split (30/5/65) with goalKcal=2000');
const intake4 = makeIntake('keto', 2000);
const result4 = calculator.calculate(intake4);

const expectedProtein4 = Math.round((2000 * MACRO_SPLITS.keto.protein) / 4);
const expectedCarbs4 = Math.round((2000 * MACRO_SPLITS.keto.carbs) / 4);
const expectedFat4 = Math.round((2000 * MACRO_SPLITS.keto.fat) / 9);

console.log(`  Goal Calories: ${result4.goalKcal} (expected 2000)`);
console.log(`  Protein: ${result4.proteinTargetG}g (expected ${expectedProtein4}g)`);
console.log(`  Carbs: ${result4.carbsTargetG}g (expected ${expectedCarbs4}g)`);
console.log(`  Fat: ${result4.fatTargetG}g (expected ${expectedFat4}g)`);
console.log(`  Macro Split: ${result4.macroSplit.proteinPercent}% / ${result4.macroSplit.carbsPercent}% / ${result4.macroSplit.fatPercent}%`);
const pass4 = result4.proteinTargetG === expectedProtein4 &&
              result4.carbsTargetG === expectedCarbs4 &&
              result4.fatTargetG === expectedFat4 &&
              result4.macroSplit.proteinPercent === 30 &&
              result4.macroSplit.carbsPercent === 5 &&
              result4.macroSplit.fatPercent === 65;
console.log(`  ${pass4 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass4) allPass = false;

// --- Test 5: Verify all macro styles at once ---
console.log('Test 5: Verify all macro styles');
let pass5 = true;
for (const [style, splits] of Object.entries(MACRO_SPLITS)) {
  const intake = makeIntake(style, 2000);
  const result = calculator.calculate(intake);

  const expectedProtein = Math.round((2000 * splits.protein) / 4);
  const expectedCarbs = Math.round((2000 * splits.carbs) / 4);
  const expectedFat = Math.round((2000 * splits.fat) / 9);

  const ok = result.proteinTargetG === expectedProtein &&
             result.carbsTargetG === expectedCarbs &&
             result.fatTargetG === expectedFat &&
             result.macroSplit.proteinPercent === splits.protein * 100 &&
             result.macroSplit.carbsPercent === splits.carbs * 100 &&
             result.macroSplit.fatPercent === splits.fat * 100;

  console.log(`  ${style}: P/C/F = ${result.proteinTargetG}/${result.carbsTargetG}/${result.fatTargetG}g ` +
              `(${result.macroSplit.proteinPercent}/${result.macroSplit.carbsPercent}/${result.macroSplit.fatPercent}%) ` +
              `${ok ? '✅' : '❌'}`);
  if (!ok) pass5 = false;
}
console.log(`  ${pass5 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass5) allPass = false;

// --- Test 6: Test with different calorie targets ---
console.log('Test 6: Balanced split with different calorie targets');
let pass6 = true;
const testCalories = [1500, 2000, 2500, 3000];

for (const kcal of testCalories) {
  const intake = makeIntake('balanced', kcal);
  const result = calculator.calculate(intake);

  const expectedProtein = Math.round((kcal * MACRO_SPLITS.balanced.protein) / 4);
  const expectedCarbs = Math.round((kcal * MACRO_SPLITS.balanced.carbs) / 4);
  const expectedFat = Math.round((kcal * MACRO_SPLITS.balanced.fat) / 9);

  const ok = result.goalKcal === kcal &&
             result.proteinTargetG === expectedProtein &&
             result.carbsTargetG === expectedCarbs &&
             result.fatTargetG === expectedFat;

  console.log(`  ${kcal} kcal: P/C/F = ${result.proteinTargetG}/${result.carbsTargetG}/${result.fatTargetG}g ` +
              `(expected ${expectedProtein}/${expectedCarbs}/${expectedFat}) ${ok ? '✅' : '❌'}`);
  if (!ok) pass6 = false;
}
console.log(`  ${pass6 ? '✅ PASS' : '❌ FAIL'}\n`);
if (!pass6) allPass = false;

// --- Summary ---
console.log('=== Summary ===');
console.log(`All tests: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
process.exit(allPass ? 0 : 1);
