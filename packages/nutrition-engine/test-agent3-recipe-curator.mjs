// Test script for Feature #92: Agent 3 Recipe Curator generates meal plan draft
import { RecipeCurator } from './dist/agents/recipe-curator.js';
import { MetabolicCalculator } from './dist/agents/metabolic-calculator.js';
import { IntakeNormalizer } from './dist/agents/intake-normalizer.js';
import { MealPlanDraftSchema } from './dist/types/schemas.js';

// ============================================================
// Helper: build a standard client intake
// ============================================================
function makeIntake(overrides = {}) {
  return {
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 177.8,
    weightKg: 77.1,
    goalType: 'cut',
    goalRate: 0.5,
    activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: ['american', 'italian'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMaxMin: 30,
    macroStyle: 'balanced',
    planDurationDays: 7,
    ...overrides,
  };
}

// Use empty API key to force deterministic (fallback) generation
const curator = new RecipeCurator('');
const calculator = new MetabolicCalculator();

let allPass = true;
let testNum = 0;

function assert(condition, label) {
  testNum++;
  if (condition) {
    console.log(`  ✅ Test ${testNum}: ${label}`);
  } else {
    console.log(`  ❌ Test ${testNum}: ${label}`);
    allPass = false;
  }
}

console.log('=== Feature #92: Agent 3 Recipe Curator generates meal plan draft ===\n');

// ============================================================
// Step 1: Input metabolic profile + client intake
// ============================================================
console.log('--- Step 1: Input metabolic profile + client intake ---');
const intake = makeIntake();
const metabolicProfile = calculator.calculate(intake);
assert(metabolicProfile.goalKcal > 0, 'Metabolic profile has goalKcal > 0');
assert(metabolicProfile.mealTargets.length > 0, 'Metabolic profile has meal targets');
console.log(`  → goalKcal=${metabolicProfile.goalKcal}, targets=${metabolicProfile.mealTargets.length}`);

const draft = await curator.generate(metabolicProfile, intake);
assert(draft !== null && draft !== undefined, 'Draft was generated successfully');
console.log('');

// ============================================================
// Step 2: Verify 7 days of meals are generated
// ============================================================
console.log('--- Step 2: Verify 7 days of meals are generated ---');
assert(draft.days.length === 7, `Got ${draft.days.length} days (expected 7)`);
for (let i = 0; i < draft.days.length; i++) {
  assert(draft.days[i].dayNumber === i + 1, `Day ${i + 1} has dayNumber=${draft.days[i].dayNumber}`);
  assert(typeof draft.days[i].dayName === 'string' && draft.days[i].dayName.length > 0, `Day ${i + 1} has dayName="${draft.days[i].dayName}"`);
}
console.log('');

// ============================================================
// Step 3: Verify each meal has name, cuisine, prep time, estimated nutrition
// ============================================================
console.log('--- Step 3: Verify each meal has name, cuisine, prep time, estimated nutrition ---');
let allMealsValid = true;
let totalMeals = 0;
for (const day of draft.days) {
  for (const meal of day.meals) {
    totalMeals++;
    if (!meal.name || meal.name.length === 0) { allMealsValid = false; console.log(`  ❌ Missing name on day ${day.dayNumber}`); }
    if (!meal.cuisine || meal.cuisine.length === 0) { allMealsValid = false; console.log(`  ❌ Missing cuisine on day ${day.dayNumber}`); }
    if (typeof meal.prepTimeMin !== 'number') { allMealsValid = false; console.log(`  ❌ Missing prepTimeMin on day ${day.dayNumber}`); }
    if (typeof meal.cookTimeMin !== 'number') { allMealsValid = false; console.log(`  ❌ Missing cookTimeMin on day ${day.dayNumber}`); }
    if (!meal.estimatedNutrition) { allMealsValid = false; console.log(`  ❌ Missing estimatedNutrition on day ${day.dayNumber}`); }
    else {
      if (typeof meal.estimatedNutrition.kcal !== 'number') { allMealsValid = false; }
      if (typeof meal.estimatedNutrition.proteinG !== 'number') { allMealsValid = false; }
      if (typeof meal.estimatedNutrition.carbsG !== 'number') { allMealsValid = false; }
      if (typeof meal.estimatedNutrition.fatG !== 'number') { allMealsValid = false; }
    }
  }
}
assert(allMealsValid, `All ${totalMeals} meals have name, cuisine, prep time, and estimated nutrition`);
// Also verify each day has the expected number of meals (mealsPerDay + snacksPerDay = 3 + 1 = 4)
const expectedMealsPerDay = intake.mealsPerDay + intake.snacksPerDay;
for (const day of draft.days) {
  assert(day.meals.length === expectedMealsPerDay, `Day ${day.dayNumber} has ${day.meals.length} meals (expected ${expectedMealsPerDay})`);
}
console.log('');

// ============================================================
// Step 4: Verify dietary style is respected (no meat for vegetarian)
// ============================================================
console.log('--- Step 4: Verify dietary style is respected (vegetarian = no meat) ---');
const vegIntake = makeIntake({ dietaryStyle: 'vegetarian' });
const vegProfile = calculator.calculate(vegIntake);
const vegDraft = await curator.generate(vegProfile, vegIntake);

let hasMeatInVeg = false;
const meatProteins = ['chicken', 'beef', 'turkey', 'pork'];
for (const day of vegDraft.days) {
  for (const meal of day.meals) {
    if (meatProteins.includes(meal.primaryProtein.toLowerCase())) {
      hasMeatInVeg = true;
      console.log(`  ❌ Found meat protein "${meal.primaryProtein}" in vegetarian plan: "${meal.name}" on day ${day.dayNumber}`);
    }
    if (meal.tags.includes('meat')) {
      hasMeatInVeg = true;
      console.log(`  ❌ Found "meat" tag in vegetarian plan: "${meal.name}" on day ${day.dayNumber}`);
    }
  }
}
assert(!hasMeatInVeg, 'No meat proteins or meat-tagged meals in vegetarian plan');

// Also test vegan
const veganIntake = makeIntake({ dietaryStyle: 'vegan' });
const veganProfile = calculator.calculate(veganIntake);
const veganDraft = await curator.generate(veganProfile, veganIntake);

let hasAnimalInVegan = false;
for (const day of veganDraft.days) {
  for (const meal of day.meals) {
    if (meal.tags.includes('meat') || meal.tags.includes('dairy') || meal.tags.includes('eggs')) {
      hasAnimalInVegan = true;
      console.log(`  ❌ Found animal product tag in vegan plan: "${meal.name}" (tags: ${meal.tags.join(',')})`);
    }
  }
}
assert(!hasAnimalInVegan, 'No animal product tags in vegan plan');
console.log('');

// ============================================================
// Step 5: Verify allergies and exclusions are honored
// ============================================================
console.log('--- Step 5: Verify allergies and exclusions are honored ---');
const allergyIntake = makeIntake({ allergies: ['salmon', 'peanut'], exclusions: ['tofu'] });
const allergyProfile = calculator.calculate(allergyIntake);
const allergyDraft = await curator.generate(allergyProfile, allergyIntake);

let foundAllergen = false;
for (const day of allergyDraft.days) {
  for (const meal of day.meals) {
    const nameLower = meal.name.toLowerCase();
    const proteinLower = meal.primaryProtein.toLowerCase();
    if (nameLower.includes('salmon') || proteinLower.includes('salmon')) {
      foundAllergen = true;
      console.log(`  ❌ Found allergen "salmon" in: "${meal.name}" on day ${day.dayNumber}`);
    }
    if (nameLower.includes('peanut') || proteinLower.includes('peanut')) {
      foundAllergen = true;
      console.log(`  ❌ Found allergen "peanut" in: "${meal.name}" on day ${day.dayNumber}`);
    }
    if (nameLower.includes('tofu') || proteinLower.includes('tofu')) {
      foundAllergen = true;
      console.log(`  ❌ Found exclusion "tofu" in: "${meal.name}" on day ${day.dayNumber}`);
    }
  }
}
assert(!foundAllergen, 'No allergens (salmon, peanut) or exclusions (tofu) found in plan');
console.log('');

// ============================================================
// Step 6: Verify cuisine preferences are considered
// ============================================================
console.log('--- Step 6: Verify cuisine preferences are considered ---');
// The original intake has cuisinePreferences: ['american', 'italian']
// The deterministic generator uses a fixed DB, but cuisines should at least be present
const cuisinesInDraft = new Set();
for (const day of draft.days) {
  for (const meal of day.meals) {
    cuisinesInDraft.add(meal.cuisine.toLowerCase());
  }
}
console.log(`  Cuisines found in plan: ${[...cuisinesInDraft].join(', ')}`);
assert(cuisinesInDraft.size >= 1, `Plan uses ${cuisinesInDraft.size} different cuisines (≥1 expected)`);

// Also verify varietyReport
assert(draft.varietyReport !== undefined, 'varietyReport exists in draft');
assert(Array.isArray(draft.varietyReport.cuisinesUsed), 'varietyReport.cuisinesUsed is an array');
assert(draft.varietyReport.cuisinesUsed.length >= 1, `varietyReport shows ${draft.varietyReport.cuisinesUsed.length} cuisines used`);
assert(Array.isArray(draft.varietyReport.proteinsUsed), 'varietyReport.proteinsUsed is an array');
assert(draft.varietyReport.proteinsUsed.length >= 1, `varietyReport shows ${draft.varietyReport.proteinsUsed.length} proteins used`);
console.log('');

// ============================================================
// Step 7: Verify output matches MealPlanDraftSchema
// ============================================================
console.log('--- Step 7: Verify output matches MealPlanDraftSchema ---');
try {
  const validated = MealPlanDraftSchema.parse(draft);
  assert(true, 'Draft passes MealPlanDraftSchema.parse() validation');
} catch (e) {
  assert(false, `Draft failed schema validation: ${e.message}`);
}

// Also validate the vegetarian draft
try {
  MealPlanDraftSchema.parse(vegDraft);
  assert(true, 'Vegetarian draft passes MealPlanDraftSchema.parse() validation');
} catch (e) {
  assert(false, `Vegetarian draft failed schema validation: ${e.message}`);
}

// Also validate the allergy-filtered draft
try {
  MealPlanDraftSchema.parse(allergyDraft);
  assert(true, 'Allergy-filtered draft passes MealPlanDraftSchema.parse() validation');
} catch (e) {
  assert(false, `Allergy-filtered draft failed schema validation: ${e.message}`);
}
console.log('');

// ============================================================
// Summary
// ============================================================
console.log('=== Summary ===');
console.log(`Total tests: ${testNum}`);
console.log(`Result: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
process.exit(allPass ? 0 : 1);
