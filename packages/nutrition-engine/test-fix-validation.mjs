/**
 * Targeted validation for the olive oil + quinoa fixes.
 * Tests NutritionCompiler directly with mock meals — no Claude API needed.
 * Only uses FatSecret (and optionally USDA) for ingredient lookups.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { NutritionCompiler, kcalFromMacros, FatSecretAdapter, USDAAdapter } = require('./dist/index.js');
import { readFileSync } from 'fs';
import { join } from 'path';

// Load env
const envPath = join(import.meta.dirname, '..', '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const fatSecretAdapter = new FatSecretAdapter(
  process.env.FATSECRET_CLIENT_ID,
  process.env.FATSECRET_CLIENT_SECRET
);

let usdaAdapter = undefined;
if (process.env.USDA_API_KEY) {
  usdaAdapter = new USDAAdapter(process.env.USDA_API_KEY);
}

const compiler = new NutritionCompiler(fatSecretAdapter, usdaAdapter);

// ─────────────────────────────────────────────────────
// Test meals that exercise the two bug fixes
// ─────────────────────────────────────────────────────

const testMeals = [
  {
    name: 'Olive Oil Bug Test — Cod with Olive Oil, Quinoa, and Feta',
    description: 'Directly tests the olive oil kcalPerGram threshold and quinoa cooked state',
    meal: {
      slot: 'lunch',
      name: 'Mediterranean Cod with Quinoa and Feta',
      cuisine: 'mediterranean',
      prepTimeMin: 15,
      cookTimeMin: 20,
      suggestedServings: 1,
      foodSearchQuery: 'cod with quinoa and feta',
      targetNutrition: { kcal: 550, proteinG: 40, carbsG: 45, fatG: 22 },
      estimatedNutrition: { kcal: 550, proteinG: 40, carbsG: 45, fatG: 22 },
      primaryProtein: 'cod',
      tags: ['mediterranean', 'high-protein'],
      draftIngredients: [
        { name: 'Cod Fillet', quantity: 170, unit: 'g' },
        { name: 'Olive Oil', quantity: 22.91, unit: 'g' },
        { name: 'Quinoa, Cooked', quantity: 159.37, unit: 'g' },
        { name: 'Feta Cheese', quantity: 28, unit: 'g' },
        { name: 'Cherry Tomatoes', quantity: 80, unit: 'g' },
        { name: 'Spinach', quantity: 50, unit: 'g' },
      ],
    },
  },
  {
    name: 'Pure Olive Oil Test — High Amount',
    description: 'Tests olive oil at various quantities to ensure it passes threshold',
    meal: {
      slot: 'dinner',
      name: 'Simple Olive Oil Salad',
      cuisine: 'mediterranean',
      prepTimeMin: 5,
      cookTimeMin: 0,
      suggestedServings: 1,
      foodSearchQuery: 'olive oil salad',
      targetNutrition: { kcal: 350, proteinG: 5, carbsG: 10, fatG: 30 },
      estimatedNutrition: { kcal: 350, proteinG: 5, carbsG: 10, fatG: 30 },
      primaryProtein: 'none',
      tags: ['salad'],
      draftIngredients: [
        { name: 'Olive Oil', quantity: 30, unit: 'g' },
        { name: 'Spinach', quantity: 100, unit: 'g' },
        { name: 'Cherry Tomatoes', quantity: 100, unit: 'g' },
      ],
    },
  },
  {
    name: 'Quinoa Cooked State Test',
    description: 'Tests that "Quinoa, Cooked" gets cooked macros (~120 kcal/100g) not dry (~368 kcal/100g)',
    meal: {
      slot: 'lunch',
      name: 'Quinoa Bowl',
      cuisine: 'american',
      prepTimeMin: 10,
      cookTimeMin: 15,
      suggestedServings: 1,
      foodSearchQuery: 'quinoa bowl',
      targetNutrition: { kcal: 400, proteinG: 20, carbsG: 50, fatG: 12 },
      estimatedNutrition: { kcal: 400, proteinG: 20, carbsG: 50, fatG: 12 },
      primaryProtein: 'chicken',
      tags: ['bowl'],
      draftIngredients: [
        { name: 'Quinoa, Cooked', quantity: 200, unit: 'g' },
        { name: 'Chicken Breast', quantity: 120, unit: 'g' },
        { name: 'Broccoli', quantity: 80, unit: 'g' },
      ],
    },
  },
  {
    name: 'Cooked Quinoa (reversed name) Test',
    description: 'Tests "Cooked Quinoa" ingredient name mapping',
    meal: {
      slot: 'dinner',
      name: 'Cooked Quinoa Salad',
      cuisine: 'mediterranean',
      prepTimeMin: 5,
      cookTimeMin: 0,
      suggestedServings: 1,
      foodSearchQuery: 'quinoa salad',
      targetNutrition: { kcal: 300, proteinG: 12, carbsG: 40, fatG: 8 },
      estimatedNutrition: { kcal: 300, proteinG: 12, carbsG: 40, fatG: 8 },
      primaryProtein: 'none',
      tags: ['salad'],
      draftIngredients: [
        { name: 'Cooked Quinoa', quantity: 200, unit: 'g' },
        { name: 'Cucumber', quantity: 80, unit: 'g' },
        { name: 'Olive Oil', quantity: 10, unit: 'g' },
      ],
    },
  },
  {
    name: 'Coconut Oil Threshold Test',
    description: 'Tests another high-density oil with ml-based serving',
    meal: {
      slot: 'breakfast',
      name: 'Eggs with Coconut Oil',
      cuisine: 'american',
      prepTimeMin: 5,
      cookTimeMin: 10,
      suggestedServings: 1,
      foodSearchQuery: 'scrambled eggs',
      targetNutrition: { kcal: 350, proteinG: 20, carbsG: 5, fatG: 28 },
      estimatedNutrition: { kcal: 350, proteinG: 20, carbsG: 5, fatG: 28 },
      primaryProtein: 'eggs',
      tags: ['breakfast'],
      draftIngredients: [
        { name: 'Eggs', quantity: 150, unit: 'g' },
        { name: 'Coconut Oil', quantity: 20, unit: 'g' },
      ],
    },
  },
  {
    name: 'Cooked Rice Test',
    description: 'Tests "rice cooked" map entry',
    meal: {
      slot: 'dinner',
      name: 'Rice and Chicken',
      cuisine: 'asian',
      prepTimeMin: 10,
      cookTimeMin: 20,
      suggestedServings: 1,
      foodSearchQuery: 'chicken rice',
      targetNutrition: { kcal: 500, proteinG: 35, carbsG: 55, fatG: 12 },
      estimatedNutrition: { kcal: 500, proteinG: 35, carbsG: 55, fatG: 12 },
      primaryProtein: 'chicken',
      tags: ['asian'],
      draftIngredients: [
        { name: 'Chicken Breast', quantity: 150, unit: 'g' },
        { name: 'Rice, Cooked', quantity: 200, unit: 'g' },
        { name: 'Broccoli', quantity: 100, unit: 'g' },
        { name: 'Soy Sauce', quantity: 15, unit: 'g' },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────
// Run each test meal through the compiler
// ─────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   FIX VALIDATION: Olive Oil + Quinoa Cooked/Dry Bugs   ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;
const failures = [];

for (const test of testMeals) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`TEST: ${test.name}`);
  console.log(`  ${test.description}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    // compileMealFromIngredients is private, so we'll use compile() with a mock draft
    const mockDraft = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: true,
          targetKcal: test.meal.targetNutrition.kcal * 3,
          meals: [test.meal],
        },
      ],
    };

    const result = await compiler.compile(mockDraft);
    const meal = result.days[0].meals[0];

    console.log(`  Confidence: ${meal.confidenceLevel}`);
    console.log(`  Nutrition: ${meal.nutrition.kcal} kcal | P: ${meal.nutrition.proteinG}g | C: ${meal.nutrition.carbsG}g | F: ${meal.nutrition.fatG}g | Fiber: ${meal.nutrition.fiberG ?? 'N/A'}g`);
    console.log(`  Ingredients:`);
    for (const ing of meal.ingredients) {
      console.log(`    - ${ing.name}: ${ing.amount}${ing.unit} ${ing.foodId ? '✓ verified' : '✗ unverified'}`);
    }

    // Validation checks
    const checks = [];

    // Check: olive oil should contribute fat > 0 when present
    const hasOliveOil = test.meal.draftIngredients.some(i => i.name.toLowerCase().includes('olive oil'));
    if (hasOliveOil) {
      const oliveOilQty = test.meal.draftIngredients.find(i => i.name.toLowerCase().includes('olive oil')).quantity;
      // Olive oil is ~100% fat. 22.91g should contribute ~22g fat
      const expectedMinFat = oliveOilQty * 0.7; // at least 70% of weight should be fat
      if (meal.nutrition.fatG >= expectedMinFat * 0.5) {
        checks.push({ pass: true, msg: `✅ Olive oil fat: ${meal.nutrition.fatG}g total fat (olive oil ~${oliveOilQty}g → expects ≥${Math.round(expectedMinFat * 0.5)}g contribution)` });
      } else {
        checks.push({ pass: false, msg: `❌ Olive oil fat TOO LOW: ${meal.nutrition.fatG}g total fat for ${oliveOilQty}g olive oil (expected ≥${Math.round(expectedMinFat * 0.5)}g)` });
      }
    }

    // Check: quinoa cooked should have reasonable carbs (not dry values)
    const hasQuinoa = test.meal.draftIngredients.some(i => i.name.toLowerCase().includes('quinoa'));
    if (hasQuinoa) {
      const quinoaQty = test.meal.draftIngredients.find(i => i.name.toLowerCase().includes('quinoa')).quantity;
      // Cooked quinoa: ~21g carbs per 100g. Dry quinoa: ~64g carbs per 100g.
      // For 200g cooked quinoa: expect ~42g carbs (not ~128g)
      const maxReasonableCarbs = quinoaQty * 0.35; // dry would be ~0.64g/g, cooked ~0.21g/g. 0.35 is midpoint
      if (meal.nutrition.carbsG <= maxReasonableCarbs) {
        checks.push({ pass: true, msg: `✅ Quinoa carbs: ${meal.nutrition.carbsG}g (≤${Math.round(maxReasonableCarbs)}g threshold for ${quinoaQty}g cooked quinoa)` });
      } else {
        checks.push({ pass: false, msg: `❌ Quinoa carbs TOO HIGH: ${meal.nutrition.carbsG}g (>${Math.round(maxReasonableCarbs)}g — likely using DRY values for ${quinoaQty}g)` });
      }
    }

    // Check: coconut oil should contribute fat > 0 when present
    const hasCoconutOil = test.meal.draftIngredients.some(i => i.name.toLowerCase().includes('coconut oil'));
    if (hasCoconutOil) {
      const cocoOilQty = test.meal.draftIngredients.find(i => i.name.toLowerCase().includes('coconut oil')).quantity;
      if (meal.nutrition.fatG >= cocoOilQty * 0.5) {
        checks.push({ pass: true, msg: `✅ Coconut oil fat: ${meal.nutrition.fatG}g total fat (coconut oil ${cocoOilQty}g)` });
      } else {
        checks.push({ pass: false, msg: `❌ Coconut oil fat TOO LOW: ${meal.nutrition.fatG}g total fat for ${cocoOilQty}g coconut oil` });
      }
    }

    // Check: confidence should be "verified" (not ai_estimated) if FatSecret matched
    if (meal.confidenceLevel === 'verified') {
      checks.push({ pass: true, msg: `✅ Confidence: verified` });
    } else {
      checks.push({ pass: false, msg: `⚠️  Confidence: ai_estimated (some ingredients may not have matched)` });
    }

    for (const c of checks) {
      console.log(`  ${c.msg}`);
      if (!c.pass) {
        failures.push({ test: test.name, msg: c.msg });
        failed++;
      } else {
        passed++;
      }
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
    failures.push({ test: test.name, msg: err.message });
    failed++;
  }
}

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}`);

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  for (const f of failures) {
    console.log(`    ${f.test}: ${f.msg}`);
  }
}

console.log('');
process.exit(failures.length > 0 ? 1 : 0);
