// Test script for Feature #118: Agent 3 enforces variety rules
import { RecipeCurator } from './dist/agents/recipe-curator.js';
import { MetabolicCalculator } from './dist/agents/metabolic-calculator.js';
import { IntakeNormalizer } from './dist/agents/intake-normalizer.js';

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
    cuisinePreferences: ['american', 'italian', 'mexican', 'japanese'],
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

console.log('=== Feature #118: Agent 3 enforces variety rules ===\n');

// ============================================================
// Step 1: Generate a meal plan draft
// ============================================================
console.log('--- Step 1: Generate a meal plan draft ---');
const intake = makeIntake();
const metabolicProfile = calculator.calculate(intake);
const draft = await curator.generate(metabolicProfile, intake);

assert(draft !== null && draft !== undefined, 'Draft was generated successfully');
assert(draft.days.length === 7, `Got ${draft.days.length} days (expected 7)`);
console.log(
  `  → Generated ${draft.days.length} days with ${draft.days[0].meals.length} meals per day`
);
console.log('');

// ============================================================
// Step 2: Check no protein source appears on consecutive days
// ============================================================
console.log('--- Step 2: Check no protein source appears on consecutive days ---');

// Collect all proteins used per day (primary protein for each meal)
const proteinsByDay = [];
for (const day of draft.days) {
  const dayProteins = new Set();
  for (const meal of day.meals) {
    dayProteins.add(meal.primaryProtein.toLowerCase());
  }
  proteinsByDay.push([...dayProteins]);
  console.log(`  Day ${day.dayNumber} proteins: ${[...dayProteins].join(', ')}`);
}

// Check consecutive days for protein overlap
let consecutiveProteinViolation = false;
for (let i = 0; i < proteinsByDay.length - 1; i++) {
  const currentDayProteins = new Set(proteinsByDay[i]);
  const nextDayProteins = new Set(proteinsByDay[i + 1]);

  // Find any proteins that appear on both consecutive days
  const overlap = [...currentDayProteins].filter((p) => nextDayProteins.has(p));

  // Note: 'mixed', 'dairy', 'eggs' are allowed to repeat as they're not primary meat proteins
  const significantOverlap = overlap.filter(
    (p) =>
      !['mixed', 'dairy', 'eggs', 'whey', 'tofu', 'beans', 'chickpeas', 'lentils', 'soy'].includes(
        p
      )
  );

  if (significantOverlap.length > 0) {
    consecutiveProteinViolation = true;
    console.log(
      `  ❌ Days ${i + 1} and ${i + 2} share significant proteins: ${significantOverlap.join(', ')}`
    );
  }
}

assert(!consecutiveProteinViolation, 'No significant primary protein repeated on consecutive days');
console.log('');

// ============================================================
// Step 3: Check no identical meal within 3 days
// ============================================================
console.log('--- Step 3: Check no identical meal within 3 days ---');

// Track all meal names with their day numbers
const mealNameToDays = new Map();
for (const day of draft.days) {
  for (const meal of day.meals) {
    const name = meal.name.toLowerCase().trim();
    if (!mealNameToDays.has(name)) {
      mealNameToDays.set(name, []);
    }
    mealNameToDays.get(name).push(day.dayNumber);
  }
}

// Check for meals that appear within a 3-day window
let mealRepetitionViolation = false;
for (const [mealName, days] of mealNameToDays.entries()) {
  if (days.length > 1) {
    // Check if any two occurrences are within 3 days of each other
    for (let i = 0; i < days.length - 1; i++) {
      const dayDiff = Math.abs(days[i + 1] - days[i]);
      if (dayDiff < 3) {
        mealRepetitionViolation = true;
        console.log(
          `  ❌ Meal "${mealName}" appears on days ${days.join(', ')} (${dayDiff} days apart, need ≥3)`
        );
      }
    }
  }
}

assert(!mealRepetitionViolation, 'No identical meal repeated within a 3-day window');
console.log(`  → Checked ${mealNameToDays.size} unique meal names across 7 days`);
console.log('');

// ============================================================
// Step 4: Verify cuisines are spread across the week
// ============================================================
console.log('--- Step 4: Verify cuisines are spread across the week ---');

const cuisinesByDay = [];
const allCuisines = new Set();

for (const day of draft.days) {
  const dayCuisines = new Set();
  for (const meal of day.meals) {
    dayCuisines.add(meal.cuisine.toLowerCase());
    allCuisines.add(meal.cuisine.toLowerCase());
  }
  cuisinesByDay.push([...dayCuisines]);
  console.log(`  Day ${day.dayNumber} cuisines: ${[...dayCuisines].join(', ')}`);
}

console.log(`  → Total unique cuisines used: ${allCuisines.size}`);
console.log(`  → Cuisines: ${[...allCuisines].join(', ')}`);

// Check that at least 3 different cuisines are used (as per spec)
assert(allCuisines.size >= 3, `At least 3 different cuisines used (found ${allCuisines.size})`);

// Also check that cuisines are reasonably spread (not all meals using same cuisine)
let maxSingleCuisinePercentage = 0;
const totalMeals = draft.days.reduce((sum, day) => sum + day.meals.length, 0);

for (const cuisine of allCuisines) {
  let cuisineCount = 0;
  for (const day of draft.days) {
    for (const meal of day.meals) {
      if (meal.cuisine.toLowerCase() === cuisine) {
        cuisineCount++;
      }
    }
  }
  const percentage = (cuisineCount / totalMeals) * 100;
  maxSingleCuisinePercentage = Math.max(maxSingleCuisinePercentage, percentage);
  console.log(`  → ${cuisine}: ${cuisineCount}/${totalMeals} meals (${percentage.toFixed(1)}%)`);
}

// No single cuisine should dominate more than 70% of meals
assert(
  maxSingleCuisinePercentage < 70,
  `No single cuisine dominates >70% of meals (max: ${maxSingleCuisinePercentage.toFixed(1)}%)`
);
console.log('');

// ============================================================
// Step 5: Verify variety report includes proteinsUsed and cuisinesUsed
// ============================================================
console.log('--- Step 5: Verify variety report includes proteinsUsed and cuisinesUsed ---');

assert(draft.varietyReport !== undefined, 'varietyReport exists in draft');
assert(typeof draft.varietyReport === 'object', 'varietyReport is an object');

// Check proteinsUsed
assert(Array.isArray(draft.varietyReport.proteinsUsed), 'varietyReport.proteinsUsed is an array');
assert(
  draft.varietyReport.proteinsUsed.length > 0,
  `varietyReport.proteinsUsed has ${draft.varietyReport.proteinsUsed.length} proteins`
);
console.log(
  `  → proteinsUsed (${draft.varietyReport.proteinsUsed.length}): ${draft.varietyReport.proteinsUsed.join(', ')}`
);

// Check cuisinesUsed
assert(Array.isArray(draft.varietyReport.cuisinesUsed), 'varietyReport.cuisinesUsed is an array');
assert(
  draft.varietyReport.cuisinesUsed.length > 0,
  `varietyReport.cuisinesUsed has ${draft.varietyReport.cuisinesUsed.length} cuisines`
);
console.log(
  `  → cuisinesUsed (${draft.varietyReport.cuisinesUsed.length}): ${draft.varietyReport.cuisinesUsed.join(', ')}`
);

// Check recipeIdsUsed (should be empty array for deterministic generation)
assert(Array.isArray(draft.varietyReport.recipeIdsUsed), 'varietyReport.recipeIdsUsed is an array');
console.log(`  → recipeIdsUsed: ${draft.varietyReport.recipeIdsUsed.length} entries`);

// Verify that the variety report actually matches what's in the plan
const proteinsInPlan = new Set();
const cuisinesInPlan = new Set();
for (const day of draft.days) {
  for (const meal of day.meals) {
    proteinsInPlan.add(meal.primaryProtein.toLowerCase());
    cuisinesInPlan.add(meal.cuisine.toLowerCase());
  }
}

// Check if varietyReport proteins match actual proteins
const reportProteins = new Set(draft.varietyReport.proteinsUsed.map((p) => p.toLowerCase()));
const proteinsMatch = [...proteinsInPlan].every((p) => reportProteins.has(p));
assert(proteinsMatch, 'varietyReport.proteinsUsed matches all proteins in plan');

// Check if varietyReport cuisines match actual cuisines
const reportCuisines = new Set(draft.varietyReport.cuisinesUsed.map((c) => c.toLowerCase()));
const cuisinesMatch = [...cuisinesInPlan].every((c) => reportCuisines.has(c));
assert(cuisinesMatch, 'varietyReport.cuisinesUsed matches all cuisines in plan');

console.log('');

// ============================================================
// Additional verification: Claude-based generation (if API key available)
// ============================================================
console.log('--- Additional: Check Claude-based generation variety (if API key available) ---');

const apiKey = process.env.ANTHROPIC_API_KEY || '';
if (apiKey && apiKey !== '' && !apiKey.includes('YOUR_KEY')) {
  console.log('  → ANTHROPIC_API_KEY found, testing Claude-based generation...');

  const claudeCurator = new RecipeCurator(apiKey);
  const claudeDraft = await claudeCurator.generate(metabolicProfile, intake);

  if (claudeDraft && claudeDraft.days) {
    console.log('  → Claude draft generated successfully');

    // Check variety report
    assert(claudeDraft.varietyReport !== undefined, 'Claude draft has varietyReport');
    assert(
      Array.isArray(claudeDraft.varietyReport.proteinsUsed),
      'Claude draft has proteinsUsed array'
    );
    assert(
      Array.isArray(claudeDraft.varietyReport.cuisinesUsed),
      'Claude draft has cuisinesUsed array'
    );

    console.log(`  → Claude proteinsUsed: ${claudeDraft.varietyReport.proteinsUsed.join(', ')}`);
    console.log(`  → Claude cuisinesUsed: ${claudeDraft.varietyReport.cuisinesUsed.join(', ')}`);

    // Check consecutive proteins in Claude draft
    const claudeProteinsByDay = [];
    for (const day of claudeDraft.days) {
      const dayProteins = new Set();
      for (const meal of day.meals) {
        dayProteins.add(meal.primaryProtein.toLowerCase());
      }
      claudeProteinsByDay.push([...dayProteins]);
    }

    let claudeProteinViolation = false;
    for (let i = 0; i < claudeProteinsByDay.length - 1; i++) {
      const current = new Set(claudeProteinsByDay[i]);
      const next = new Set(claudeProteinsByDay[i + 1]);
      const overlap = [...current].filter((p) => next.has(p));
      const significantOverlap = overlap.filter(
        (p) =>
          ![
            'mixed',
            'dairy',
            'eggs',
            'whey',
            'tofu',
            'beans',
            'chickpeas',
            'lentils',
            'soy',
          ].includes(p)
      );
      if (significantOverlap.length > 0) {
        claudeProteinViolation = true;
        console.log(
          `  ⚠️  Claude draft has consecutive protein overlap: ${significantOverlap.join(', ')}`
        );
      }
    }

    if (!claudeProteinViolation) {
      console.log('  ✅ Claude draft respects consecutive protein rule');
    }

    // Check 3-day meal repetition in Claude draft
    const claudeMealNameToDays = new Map();
    for (const day of claudeDraft.days) {
      for (const meal of day.meals) {
        const name = meal.name.toLowerCase().trim();
        if (!claudeMealNameToDays.has(name)) {
          claudeMealNameToDays.set(name, []);
        }
        claudeMealNameToDays.get(name).push(day.dayNumber);
      }
    }

    let claudeMealViolation = false;
    for (const [mealName, days] of claudeMealNameToDays.entries()) {
      if (days.length > 1) {
        for (let i = 0; i < days.length - 1; i++) {
          const dayDiff = Math.abs(days[i + 1] - days[i]);
          if (dayDiff < 3) {
            claudeMealViolation = true;
            console.log(
              `  ⚠️  Claude draft has meal repetition: "${mealName}" on days ${days.join(', ')}`
            );
          }
        }
      }
    }

    if (!claudeMealViolation) {
      console.log('  ✅ Claude draft respects 3-day meal repetition rule');
    }
  } else {
    console.log('  ⚠️  Claude draft generation returned null/undefined (expected fallback used)');
  }
} else {
  console.log('  → No ANTHROPIC_API_KEY found, skipping Claude-based test');
}

console.log('');

// ============================================================
// Summary
// ============================================================
console.log('=== Summary ===');
console.log(`Total tests: ${testNum}`);
console.log(`Result: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
process.exit(allPass ? 0 : 1);
