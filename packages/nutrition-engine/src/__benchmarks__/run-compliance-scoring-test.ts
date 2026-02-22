#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * 5-Persona Compliance Scoring Test with USDA Fallback Verification
 *
 * Runs 5 personas (chosen to stress-test dietary compliance) through the full
 * pipeline with live APIs, then scores each plan on 5 weighted categories:
 *   A: Nutritional Accuracy (30%)
 *   B: Meal Practicality (25%)
 *   C: Dietary Compliance (20%)  — critical, allergen hit = auto 1
 *   D: Variety (15%)
 *   E: Grocery Feasibility (10%)
 *
 * Also independently scans all ingredients for allergen/dietary violations
 * (separate from the pipeline's own checks) and tracks FatSecret vs USDA
 * vs unverified ingredient match rates.
 *
 * Usage:
 *   cd packages/nutrition-engine
 *   pnpm build
 *   npx tsx src/__benchmarks__/run-compliance-scoring-test.ts
 *   npx tsx src/__benchmarks__/run-compliance-scoring-test.ts --persona=raj
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  NutritionPipelineOrchestrator,
  type PipelineConfig,
  type PipelineResult,
} from '../orchestrator';
import type { RawIntakeForm, MealPlanValidated, CompiledDay, CompiledMeal } from '../types/schemas';

// ============================================================
// Load environment from monorepo root .env
// ============================================================

function loadEnv(): void {
  const envPath = resolve(__dirname, '../../../../.env');
  if (!existsSync(envPath)) {
    console.error(`ERROR: .env file not found at ${envPath}`);
    process.exit(1);
  }
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ============================================================
// Output Directory
// ============================================================

const OUTPUT_DIR = resolve(
  '/Users/zero-suminc./Desktop/ZS-MAC/NE Implementation/Nutrition Engine testing:validation'
);

// ============================================================
// Independent Allergen / Dietary Term Maps
// (Duplicated from dietary-compliance.ts so the scorer catches
//  violations the pipeline missed — scorer independence)
// ============================================================

const SCORER_ALLERGEN_TERMS: Record<string, string[]> = {
  gluten: [
    'pasta',
    'bread',
    'wheat',
    'flour',
    'lasagna',
    'noodle',
    'cracker',
    'biscuit',
    'cereal',
    'couscous',
    'barley',
    'rye',
    'tortilla',
    'pita',
    'bagel',
    'croissant',
    'muffin',
    'pancake',
    'waffle',
  ],
  dairy: [
    'cheese',
    'milk',
    'butter',
    'cream',
    'yogurt',
    'whey',
    'casein',
    'ghee',
    'ricotta',
    'mozzarella',
    'parmesan',
    'cheddar',
    'brie',
    'feta',
    'gouda',
    'provolone',
    'cottage cheese',
    'sour cream',
    'ice cream',
    'custard',
  ],
  peanut: ['peanut'],
  'tree nut': [
    'almond',
    'walnut',
    'cashew',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
  ],
  tree_nut: [
    'almond',
    'walnut',
    'cashew',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
  ],
  shellfish: [
    'shrimp',
    'crab',
    'lobster',
    'clam',
    'mussel',
    'oyster',
    'scallop',
    'crawfish',
    'crayfish',
    'prawn',
  ],
  soy: ['soy', 'tofu', 'tempeh', 'edamame', 'miso'],
  egg: ['egg'],
  fish: [
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'bass',
    'swordfish',
    'mahi',
  ],
  sesame: ['sesame', 'tahini'],
};

const SCORER_DIETARY_FORBIDDEN: Record<string, string[]> = {
  vegan: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'shrimp',
    'crab',
    'lobster',
    'prawn',
    'egg',
    'cheese',
    'milk',
    'butter',
    'cream',
    'yogurt',
    'whey',
    'honey',
    'ghee',
    'gelatin',
    'lard',
  ],
  vegetarian: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'shrimp',
    'crab',
    'lobster',
    'prawn',
    'gelatin',
    'lard',
  ],
  pescatarian: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'lard',
  ],
};

// ============================================================
// 5 Compliance-Focused Personas
// ============================================================

interface PersonaDef {
  slug: string;
  name: string;
  input: RawIntakeForm;
}

const PERSONAS: PersonaDef[] = [
  {
    slug: 'marcus',
    name: 'Marcus (omnivore, no allergies)',
    input: {
      name: 'Marcus',
      sex: 'male',
      age: 32,
      heightFeet: 5,
      heightInches: 10,
      weightLbs: 195,
      goalType: 'cut',
      goalRate: 1.5,
      activityLevel: 'sedentary',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'mediterranean'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 4,
      prepTimeMaxMin: 20,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'raj',
    name: 'Raj (vegan + soy allergy)',
    input: {
      name: 'Raj',
      sex: 'male',
      age: 28,
      heightCm: 180,
      weightKg: 72,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'morning',
      dietaryStyle: 'vegan',
      allergies: ['soy'],
      exclusions: [],
      cuisinePreferences: ['mediterranean', 'indian', 'thai'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkill: 7,
      prepTimeMaxMin: 45,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
  {
    slug: 'jennifer',
    name: 'Jennifer (keto + dairy allergy)',
    input: {
      name: 'Jennifer',
      sex: 'female',
      age: 38,
      heightFeet: 5,
      heightInches: 5,
      weightLbs: 160,
      goalType: 'cut',
      goalRate: 1.0,
      activityLevel: 'lightly_active',
      trainingDays: ['tuesday', 'thursday', 'saturday'],
      dietaryStyle: 'omnivore',
      allergies: ['dairy'],
      exclusions: [],
      cuisinePreferences: ['american', 'mexican'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 6,
      prepTimeMaxMin: 30,
      macroStyle: 'keto',
      planDurationDays: 7,
    },
  },
  {
    slug: 'robert',
    name: 'Robert (4 allergens)',
    input: {
      name: 'Robert',
      sex: 'male',
      age: 67,
      heightFeet: 5,
      heightInches: 9,
      weightLbs: 180,
      goalType: 'maintain',
      goalRate: 0,
      activityLevel: 'sedentary',
      trainingDays: [],
      dietaryStyle: 'omnivore',
      allergies: ['peanut', 'tree nut', 'shellfish', 'gluten'],
      exclusions: [],
      cuisinePreferences: ['american', 'italian', 'greek'],
      mealsPerDay: 3,
      snacksPerDay: 0,
      cookingSkill: 5,
      prepTimeMaxMin: 40,
      macroStyle: 'balanced',
      planDurationDays: 7,
    },
  },
  {
    slug: 'takeshi',
    name: 'Takeshi (pescatarian bodybuilder)',
    input: {
      name: 'Takeshi',
      sex: 'male',
      age: 29,
      heightCm: 178,
      weightKg: 85,
      bodyFatPercent: 14,
      goalType: 'bulk',
      goalRate: 0.5,
      activityLevel: 'very_active',
      trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      trainingTime: 'afternoon',
      dietaryStyle: 'pescatarian',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['japanese', 'mediterranean', 'thai'],
      mealsPerDay: 5,
      snacksPerDay: 1,
      cookingSkill: 8,
      prepTimeMaxMin: 60,
      macroStyle: 'high_protein',
      planDurationDays: 7,
    },
  },
];

// ============================================================
// Independent Compliance Scanner
// ============================================================

interface ComplianceViolation {
  day: number;
  meal: string;
  ingredient: string;
  type: 'allergen' | 'dietary';
  detail: string;
}

function scanCompliance(
  plan: MealPlanValidated,
  allergies: string[],
  dietaryStyle: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const lower = ing.name.toLowerCase();

        // Check allergens
        for (const allergen of allergies) {
          const key = allergen.toLowerCase().trim();
          const terms = SCORER_ALLERGEN_TERMS[key];
          if (terms) {
            for (const term of terms) {
              if (lower.includes(term)) {
                violations.push({
                  day: day.dayNumber,
                  meal: meal.name,
                  ingredient: ing.name,
                  type: 'allergen',
                  detail: `Contains "${term}" (allergen: ${allergen})`,
                });
                break;
              }
            }
          } else if (lower.includes(key)) {
            violations.push({
              day: day.dayNumber,
              meal: meal.name,
              ingredient: ing.name,
              type: 'allergen',
              detail: `Contains "${key}" (allergen: ${allergen})`,
            });
          }
        }

        // Check dietary style
        const forbidden = SCORER_DIETARY_FORBIDDEN[dietaryStyle.toLowerCase()];
        if (forbidden) {
          for (const term of forbidden) {
            if (lower.includes(term)) {
              violations.push({
                day: day.dayNumber,
                meal: meal.name,
                ingredient: ing.name,
                type: 'dietary',
                detail: `Contains "${term}" (forbidden for ${dietaryStyle})`,
              });
              break;
            }
          }
        }
      }
    }
  }

  return violations;
}

// ============================================================
// USDA / FatSecret Coverage Tracker
// ============================================================

interface CoverageStats {
  totalIngredients: number;
  matchedFatSecret: number;
  matchedUSDA: number;
  unverified: number;
  fatSecretRate: number;
  usdaRate: number;
  totalMatchRate: number;
}

function extractCoverage(plan: MealPlanValidated): CoverageStats {
  let total = 0,
    fs = 0,
    usda = 0,
    unv = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        total++;
        if (ing.foodId) {
          if (ing.foodId.startsWith('usda-')) {
            usda++;
          } else {
            fs++;
          }
        } else {
          unv++;
        }
      }
    }
  }

  return {
    totalIngredients: total,
    matchedFatSecret: fs,
    matchedUSDA: usda,
    unverified: unv,
    fatSecretRate: total > 0 ? fs / total : 0,
    usdaRate: total > 0 ? usda / total : 0,
    totalMatchRate: total > 0 ? (fs + usda) / total : 0,
  };
}

// ============================================================
// Scoring Functions (5 Categories)
// ============================================================

interface CategoryScore {
  score: number;
  subScores: Record<string, number>;
  notes: string[];
}

// Utility: count days within ±threshold% of target
function countDaysWithin(
  days: CompiledDay[],
  getValue: (d: CompiledDay) => number,
  getTarget: (d: CompiledDay) => number,
  thresholdPct: number
): number {
  let count = 0;
  for (const day of days) {
    const val = getValue(day);
    const target = getTarget(day);
    if (target === 0) {
      count++;
      continue;
    }
    const pct = Math.abs((val - target) / target) * 100;
    if (pct <= thresholdPct) count++;
  }
  return count;
}

function daysToScore(good: number, total: number): number {
  if (total === 0) return 5;
  const ratio = good / total;
  if (ratio >= 1.0) return 9;
  if (ratio >= 6 / 7) return 8;
  if (ratio >= 5 / 7) return 7;
  if (ratio >= 4 / 7) return 6;
  if (ratio >= 3 / 7) return 5;
  if (ratio >= 2 / 7) return 4;
  return 3;
}

/**
 * Category A: Nutritional Accuracy (30%)
 */
function scoreA(plan: MealPlanValidated, sex: string): CategoryScore {
  const days = plan.days;
  const total = days.length;
  const notes: string[] = [];

  // A1: Kcal adherence (±3%)
  const a1Good = countDaysWithin(
    days,
    (d) => d.dailyTotals.kcal,
    (d) => d.targetKcal,
    3
  );
  const a1 = daysToScore(a1Good, total);
  notes.push(`A1 Kcal: ${a1Good}/${total} within ±3%`);

  // A2: Protein accuracy (±10%)
  const a2Good = countDaysWithin(
    days,
    (d) => d.dailyTotals.proteinG,
    (d) => d.macroTargets?.proteinG ?? 0,
    10
  );
  const a2 = daysToScore(a2Good, total);
  notes.push(`A2 Protein: ${a2Good}/${total} within ±10%`);

  // A3: Carbs/Fat balance (±15% each, averaged)
  const a3CarbsGood = countDaysWithin(
    days,
    (d) => d.dailyTotals.carbsG,
    (d) => d.macroTargets?.carbsG ?? 0,
    15
  );
  const a3FatGood = countDaysWithin(
    days,
    (d) => d.dailyTotals.fatG,
    (d) => d.macroTargets?.fatG ?? 0,
    15
  );
  const a3CarbScore = daysToScore(a3CarbsGood, total);
  const a3FatScore = daysToScore(a3FatGood, total);
  const a3 = (a3CarbScore + a3FatScore) / 2;
  notes.push(`A3 Carbs: ${a3CarbsGood}/${total}, Fat: ${a3FatGood}/${total}`);

  // A4: Fiber adequacy (≥25g F, ≥38g M)
  const fiberTarget = sex === 'female' ? 25 : 38;
  let a4Good = 0;
  for (const day of days) {
    if ((day.dailyTotals.fiberG ?? 0) >= fiberTarget) a4Good++;
  }
  const a4 = daysToScore(a4Good, total);
  notes.push(`A4 Fiber: ${a4Good}/${total} >= ${fiberTarget}g`);

  const score = (a1 + a2 + a3 + a4) / 4;
  return { score, subScores: { a1, a2, a3, a4 }, notes };
}

/**
 * Category B: Meal Practicality (25%)
 */
function scoreB(plan: MealPlanValidated): CategoryScore {
  const notes: string[] = [];
  let totalMeals = 0;
  let flaggedLow = 0;
  let flaggedHigh = 0;
  let totalIngCount = 0;
  let unrealisticPortions = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      totalMeals++;
      const ingCount = meal.ingredients.length;
      totalIngCount += ingCount;

      const isSnack = meal.slot.toLowerCase().includes('snack');
      if (!isSnack && ingCount < 3) flaggedLow++;
      if (ingCount > 15) flaggedHigh++;

      for (const ing of meal.ingredients) {
        if (ing.amount > 680) unrealisticPortions++;
      }
    }
  }

  const avgIng = totalMeals > 0 ? totalIngCount / totalMeals : 0;
  notes.push(
    `Avg ingredients/meal: ${avgIng.toFixed(1)}, flagged low: ${flaggedLow}, high: ${flaggedHigh}`
  );

  // B1: Ingredient count scoring
  let b1: number;
  if (flaggedLow === 0 && flaggedHigh === 0 && avgIng >= 4 && avgIng <= 8) {
    b1 = 10;
  } else if (flaggedLow <= 2 && flaggedHigh === 0 && avgIng >= 3) {
    b1 = 8;
  } else if (flaggedLow <= 5 && flaggedHigh <= 1) {
    b1 = 6;
  } else {
    b1 = 4;
  }

  // B2: Portion realism
  notes.push(`Unrealistic portions (>680g): ${unrealisticPortions}`);
  let b2: number;
  if (unrealisticPortions === 0) {
    b2 = 10;
  } else if (unrealisticPortions <= 2) {
    b2 = 8;
  } else if (unrealisticPortions <= 5) {
    b2 = 6;
  } else {
    b2 = 4;
  }

  const score = (b1 + b2) / 2;
  return { score, subScores: { b1, b2 }, notes };
}

/**
 * Category C: Dietary Compliance (20%) — CRITICAL
 * ANY allergen hit = automatic score of 1 for the entire category.
 */
function scoreC(
  plan: MealPlanValidated,
  violations: ComplianceViolation[],
  macroStyle: string
): CategoryScore {
  const notes: string[] = [];

  const allergenViolations = violations.filter((v) => v.type === 'allergen');
  const dietaryViolations = violations.filter((v) => v.type === 'dietary');

  // C1: Allergen safety — any match = immediate score 1
  if (allergenViolations.length > 0) {
    notes.push(`ALLERGEN VIOLATION: ${allergenViolations.length} hits — automatic score 1`);
    for (const v of allergenViolations.slice(0, 5)) {
      notes.push(`  Day ${v.day} "${v.meal}": ${v.ingredient} — ${v.detail}`);
    }
    if (allergenViolations.length > 5) {
      notes.push(`  ... and ${allergenViolations.length - 5} more`);
    }
    return { score: 1, subScores: { c1: 1, c2: 0, c3: 0 }, notes };
  }

  notes.push('C1 Allergen: PASS (0 violations)');

  // C2: Dietary style violations
  let c2: number;
  if (dietaryViolations.length === 0) {
    c2 = 10;
  } else if (dietaryViolations.length === 1) {
    c2 = 8;
  } else if (dietaryViolations.length <= 3) {
    c2 = 6;
  } else if (dietaryViolations.length <= 6) {
    c2 = 4;
  } else {
    c2 = 2;
  }
  notes.push(`C2 Dietary: ${dietaryViolations.length} violations => score ${c2}`);
  for (const v of dietaryViolations.slice(0, 3)) {
    notes.push(`  Day ${v.day} "${v.meal}": ${v.ingredient} — ${v.detail}`);
  }

  // C3: Keto carb check (only for macroStyle keto)
  let c3 = 10;
  if (macroStyle === 'keto') {
    let highCarbDays = 0;
    for (const day of plan.days) {
      if (day.dailyTotals.carbsG > 50) highCarbDays++;
    }
    if (highCarbDays === 0) {
      c3 = 10;
    } else if (highCarbDays <= 1) {
      c3 = 8;
    } else if (highCarbDays <= 3) {
      c3 = 6;
    } else {
      c3 = 4;
    }
    notes.push(`C3 Keto carb: ${highCarbDays} days > 50g carbs => score ${c3}`);
  } else {
    notes.push('C3 Keto carb: N/A (not keto)');
  }

  const score = (c2 + c3) / 2;
  return { score, subScores: { c1: 10, c2, c3 }, notes };
}

/**
 * Category D: Variety (15%)
 */
function scoreD(plan: MealPlanValidated, cuisinePreferences: string[]): CategoryScore {
  const notes: string[] = [];
  const allMeals: CompiledMeal[] = [];
  for (const day of plan.days) {
    for (const meal of day.meals) {
      allMeals.push(meal);
    }
  }

  // D1: Protein rotation
  const proteins = new Set<string>();
  for (const m of allMeals) {
    if (m.primaryProtein) proteins.add(m.primaryProtein.toLowerCase());
  }
  // Check consecutive-day repeats
  let consecutiveRepeats = 0;
  for (let i = 1; i < plan.days.length; i++) {
    const prevProteins = new Set(
      plan.days[i - 1].meals.map((m) => m.primaryProtein?.toLowerCase())
    );
    const currProteins = new Set(plan.days[i].meals.map((m) => m.primaryProtein?.toLowerCase()));
    const currArr = Array.from(currProteins);
    for (const p of currArr) {
      if (p && prevProteins.has(p)) consecutiveRepeats++;
    }
  }

  let d1: number;
  if (proteins.size >= 7) d1 = 10;
  else if (proteins.size >= 5) d1 = 8;
  else if (proteins.size >= 4) d1 = 7;
  else if (proteins.size >= 3) d1 = 6;
  else d1 = 4;
  if (consecutiveRepeats > 5) d1 = Math.max(d1 - 2, 2);
  notes.push(`D1 Proteins: ${proteins.size} distinct, ${consecutiveRepeats} consecutive repeats`);

  // D2: Cuisine diversity
  const cuisines = new Set<string>();
  for (const m of allMeals) {
    if (m.cuisine) cuisines.add(m.cuisine.toLowerCase());
  }
  const prefMatches = Array.from(cuisines).filter((c) =>
    cuisinePreferences.some((p) => c.includes(p.toLowerCase()) || p.toLowerCase().includes(c))
  ).length;
  const prefPct = cuisinePreferences.length > 0 ? prefMatches / cuisinePreferences.length : 1;

  let d2: number;
  if (cuisines.size >= 5 && prefPct >= 0.5) d2 = 10;
  else if (cuisines.size >= 4) d2 = 8;
  else if (cuisines.size >= 3) d2 = 7;
  else if (cuisines.size >= 2) d2 = 6;
  else d2 = 4;
  notes.push(`D2 Cuisines: ${cuisines.size} distinct, ${(prefPct * 100).toFixed(0)}% pref match`);

  // D3: Method diversity (from tags)
  const COOKING_METHODS = [
    'grilled',
    'baked',
    'stir-fry',
    'stir fry',
    'roasted',
    'steamed',
    'sauteed',
    'sautéed',
    'pan-seared',
    'braised',
    'slow-cooked',
    'raw',
    'poached',
    'fried',
    'air-fried',
    'smoked',
    'broiled',
  ];
  const methods = new Set<string>();
  for (const m of allMeals) {
    for (const tag of m.tags) {
      const lTag = tag.toLowerCase();
      for (const method of COOKING_METHODS) {
        if (lTag.includes(method)) methods.add(method);
      }
    }
  }

  let d3: number;
  if (methods.size >= 5) d3 = 10;
  else if (methods.size >= 4) d3 = 8;
  else if (methods.size >= 3) d3 = 7;
  else if (methods.size >= 2) d3 = 6;
  else d3 = 4;
  notes.push(`D3 Methods: ${methods.size} distinct (${Array.from(methods).join(', ')})`);

  // D4: Meal uniqueness (3-day sliding window)
  let duplicatesInWindow = 0;
  for (let i = 0; i <= plan.days.length - 3; i++) {
    const windowMeals: string[] = [];
    for (let j = i; j < i + 3; j++) {
      for (const m of plan.days[j].meals) {
        windowMeals.push(m.name.toLowerCase());
      }
    }
    const unique = new Set(windowMeals);
    duplicatesInWindow += windowMeals.length - unique.size;
  }

  let d4: number;
  if (duplicatesInWindow === 0) d4 = 10;
  else if (duplicatesInWindow <= 2) d4 = 8;
  else if (duplicatesInWindow <= 5) d4 = 6;
  else d4 = 4;
  notes.push(`D4 Uniqueness: ${duplicatesInWindow} duplicates in 3-day windows`);

  const score = (d1 + d2 + d3 + d4) / 4;
  return { score, subScores: { d1, d2, d3, d4 }, notes };
}

/**
 * Category E: Grocery Feasibility (10%)
 */
function scoreE(plan: MealPlanValidated): CategoryScore {
  const notes: string[] = [];

  // E1: Grocery list size
  let totalItems = 0;
  for (const category of plan.groceryList) {
    totalItems += category.items.length;
  }

  let e1: number;
  if (totalItems >= 30 && totalItems <= 40) e1 = 10;
  else if (totalItems >= 25 && totalItems <= 45) e1 = 9;
  else if (totalItems >= 20 && totalItems <= 55) e1 = 7;
  else if (totalItems >= 15 && totalItems <= 65) e1 = 5;
  else e1 = 3;
  notes.push(`E1 Grocery items: ${totalItems}`);

  // E2: Ingredient reuse ratio
  const ingredientUsage: Record<string, number> = {};
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        ingredientUsage[key] = (ingredientUsage[key] || 0) + 1;
      }
    }
  }
  const totalUnique = Object.keys(ingredientUsage).length;
  const multiUse = Object.values(ingredientUsage).filter((c) => c >= 2).length;
  const reuseRatio = totalUnique > 0 ? multiUse / totalUnique : 0;

  let e2: number;
  if (reuseRatio >= 0.5) e2 = 10;
  else if (reuseRatio >= 0.4) e2 = 8;
  else if (reuseRatio >= 0.3) e2 = 7;
  else if (reuseRatio >= 0.2) e2 = 6;
  else e2 = 4;
  notes.push(
    `E2 Reuse: ${multiUse}/${totalUnique} ingredients in 2+ meals (${(reuseRatio * 100).toFixed(0)}%)`
  );

  const score = (e1 + e2) / 2;
  return { score, subScores: { e1, e2 }, notes };
}

// ============================================================
// Composite Score
// ============================================================

interface Scorecard {
  categoryA: CategoryScore;
  categoryB: CategoryScore;
  categoryC: CategoryScore;
  categoryD: CategoryScore;
  categoryE: CategoryScore;
  composite: number;
  grade: string;
}

function computeComposite(a: number, b: number, c: number, d: number, e: number): number {
  return a * 0.3 + b * 0.25 + c * 0.2 + d * 0.15 + e * 0.1;
}

function gradeFromComposite(composite: number): string {
  if (composite >= 9) return 'Excellent';
  if (composite >= 7.5) return 'Good';
  if (composite >= 6) return 'Fair';
  if (composite >= 4) return 'Poor';
  return 'Failing';
}

function buildScorecard(
  plan: MealPlanValidated,
  violations: ComplianceViolation[],
  persona: PersonaDef
): Scorecard {
  const categoryA = scoreA(plan, persona.input.sex);
  const categoryB = scoreB(plan);
  const categoryC = scoreC(plan, violations, persona.input.macroStyle);
  const categoryD = scoreD(plan, persona.input.cuisinePreferences);
  const categoryE = scoreE(plan);

  const composite = computeComposite(
    categoryA.score,
    categoryB.score,
    categoryC.score,
    categoryD.score,
    categoryE.score
  );
  const grade = gradeFromComposite(composite);

  return { categoryA, categoryB, categoryC, categoryD, categoryE, composite, grade };
}

// ============================================================
// Main Runner
// ============================================================

interface PersonaResult {
  slug: string;
  name: string;
  success: boolean;
  error?: string;
  scorecard?: Scorecard;
  violations?: ComplianceViolation[];
  coverage?: CoverageStats;
  qaScore?: number;
  qaAdjustments?: string[];
  pipelineTimeMs: number;
}

async function main(): Promise<void> {
  loadEnv();

  // Parse --persona filter
  const personaFilter = process.argv
    .find((a) => a.startsWith('--persona='))
    ?.split('=')[1]
    ?.toLowerCase();

  const selectedPersonas = personaFilter
    ? PERSONAS.filter((p) => p.slug === personaFilter)
    : PERSONAS;

  if (selectedPersonas.length === 0) {
    console.error(
      `Unknown persona: "${personaFilter}". Valid: ${PERSONAS.map((p) => p.slug).join(', ')}`
    );
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const config: PipelineConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    usdaApiKey: process.env.USDA_API_KEY || '',
    fatsecretClientId: process.env.FATSECRET_CLIENT_ID || undefined,
    fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || undefined,
  };

  console.log('='.repeat(70));
  console.log('  Compliance Scoring Test — 5 Personas, Full Pipeline');
  console.log('='.repeat(70));
  console.log(`  Personas: ${selectedPersonas.map((p) => p.slug).join(', ')}`);
  console.log(`  USDA fallback: ${config.usdaApiKey ? 'ENABLED' : 'DISABLED (no USDA_API_KEY)'}`);
  console.log(`  Output:   ${OUTPUT_DIR}`);
  console.log('='.repeat(70));
  console.log('');

  // Install PDF mock to avoid needing Chrome
  try {
    const pdfRenderer = await import('../agents/brand-renderer/pdf-renderer');
    const brandRenderer = await import('../agents/brand-renderer/index');
    const mockPdf = async () => Buffer.from('%PDF-1.4 mock');
    Object.defineProperty(pdfRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'renderPdf', {
      value: mockPdf,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(pdfRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(brandRenderer, 'closeBrowserPool', {
      value: async () => {},
      writable: true,
      configurable: true,
    });
  } catch {
    console.warn('Warning: Could not mock PDF renderer');
  }

  const allResults: PersonaResult[] = [];

  for (const persona of selectedPersonas) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Running: ${persona.name}`);
    console.log(`${'─'.repeat(60)}`);

    const orchestrator = new NutritionPipelineOrchestrator(config);
    const startTime = Date.now();

    let result: PipelineResult;
    try {
      result = await orchestrator.run(persona.input, (progress) => {
        const sub = progress.subStep ? ` — ${progress.subStep}` : '';
        console.log(`  [Agent ${progress.agent}] ${progress.agentName}: ${progress.message}${sub}`);
      });
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const elapsedMs = Date.now() - startTime;

    if (result.success && result.plan) {
      const plan = result.plan;

      // Independent compliance scan
      const violations = scanCompliance(plan, persona.input.allergies, persona.input.dietaryStyle);

      // Build scorecard
      const scorecard = buildScorecard(plan, violations, persona);

      // USDA coverage stats
      const coverage = extractCoverage(plan);

      const personaResult: PersonaResult = {
        slug: persona.slug,
        name: persona.name,
        success: true,
        scorecard,
        violations,
        coverage,
        qaScore: plan.qa.score,
        qaAdjustments: plan.qa.adjustmentsMade,
        pipelineTimeMs: elapsedMs,
      };
      allResults.push(personaResult);

      // Console output
      const allergenCount = violations.filter((v) => v.type === 'allergen').length;
      const dietaryCount = violations.filter((v) => v.type === 'dietary').length;
      console.log(`  ✓ SUCCESS in ${(elapsedMs / 1000).toFixed(1)}s`);
      console.log(`  Composite: ${scorecard.composite.toFixed(2)} (${scorecard.grade})`);
      console.log(
        `  A=${scorecard.categoryA.score.toFixed(1)} B=${scorecard.categoryB.score.toFixed(1)} C=${scorecard.categoryC.score.toFixed(1)} D=${scorecard.categoryD.score.toFixed(1)} E=${scorecard.categoryE.score.toFixed(1)}`
      );
      console.log(`  Violations: ${allergenCount} allergen, ${dietaryCount} dietary`);
      console.log(
        `  QA: ${plan.qa.score}/100 | Coverage: ${(coverage.totalMatchRate * 100).toFixed(1)}% (FS:${coverage.matchedFatSecret} USDA:${coverage.matchedUSDA} Unv:${coverage.unverified})`
      );

      if (violations.length > 0) {
        console.log('  Violation details:');
        for (const v of violations.slice(0, 5)) {
          console.log(`    Day ${v.day} "${v.meal}": ${v.ingredient} — ${v.detail}`);
        }
        if (violations.length > 5) {
          console.log(`    ... and ${violations.length - 5} more`);
        }
      }

      // Check QA compliance warnings
      const complianceAdj = (plan.qa.adjustmentsMade || []).filter((a) =>
        a.includes('[COMPLIANCE]')
      );
      if (complianceAdj.length > 0) {
        console.log(`  QA Compliance warnings: ${complianceAdj.length}`);
        for (const adj of complianceAdj) {
          console.log(`    ${adj}`);
        }
      }

      // Save individual result
      const saveResult = {
        persona: persona.name,
        slug: persona.slug,
        timestamp: new Date().toISOString(),
        pipelineTimeMs: elapsedMs,
        scorecard,
        violations,
        coverage,
        qaScore: plan.qa.score,
        qaStatus: plan.qa.status,
        qaAdjustments: plan.qa.adjustmentsMade,
        plan: {
          ...plan,
          // Omit huge arrays for file size
        },
      };

      const outputPath = resolve(OUTPUT_DIR, `compliance-test-${persona.slug}.json`);
      writeFileSync(outputPath, JSON.stringify(saveResult, null, 2), 'utf-8');
      console.log(`  Saved: compliance-test-${persona.slug}.json`);
    } else {
      const personaResult: PersonaResult = {
        slug: persona.slug,
        name: persona.name,
        success: false,
        error: result.error,
        pipelineTimeMs: elapsedMs,
      };
      allResults.push(personaResult);
      console.log(`  ✗ FAILED in ${(elapsedMs / 1000).toFixed(1)}s: ${result.error}`);

      const outputPath = resolve(OUTPUT_DIR, `compliance-test-${persona.slug}.json`);
      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            persona: persona.name,
            slug: persona.slug,
            timestamp: new Date().toISOString(),
            success: false,
            error: result.error,
            pipelineTimeMs: elapsedMs,
          },
          null,
          2
        ),
        'utf-8'
      );
    }
  }

  // ============================================================
  // Summary Report
  // ============================================================

  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);

  console.log(`\n${'='.repeat(70)}`);
  console.log('  COMPLIANCE SCORING TEST — SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`  Results: ${successful.length} succeeded, ${failed.length} failed\n`);

  if (successful.length > 0) {
    // Print scorecard table
    const header =
      '  Persona'.padEnd(32) +
      'Comp'.padStart(6) +
      'A'.padStart(6) +
      'B'.padStart(6) +
      'C'.padStart(6) +
      'D'.padStart(6) +
      'E'.padStart(6) +
      'QA'.padStart(6) +
      'Violat'.padStart(8) +
      'USDA%'.padStart(7) +
      'Time'.padStart(7);
    console.log(header);
    console.log('  ' + '─'.repeat(header.length - 2));

    for (const r of successful) {
      const sc = r.scorecard!;
      const totalViolations = r.violations?.length ?? 0;
      const usdaPct = r.coverage ? (r.coverage.usdaRate * 100).toFixed(0) : '0';
      const timeS = (r.pipelineTimeMs / 1000).toFixed(0);

      console.log(
        `  ${r.name.padEnd(30)}` +
          `${sc.composite.toFixed(2).padStart(6)}` +
          `${sc.categoryA.score.toFixed(1).padStart(6)}` +
          `${sc.categoryB.score.toFixed(1).padStart(6)}` +
          `${sc.categoryC.score.toFixed(1).padStart(6)}` +
          `${sc.categoryD.score.toFixed(1).padStart(6)}` +
          `${sc.categoryE.score.toFixed(1).padStart(6)}` +
          `${String(r.qaScore ?? '-').padStart(6)}` +
          `${String(totalViolations).padStart(8)}` +
          `${(usdaPct + '%').padStart(7)}` +
          `${(timeS + 's').padStart(7)}`
      );
    }

    console.log('  ' + '─'.repeat(header.length - 2));

    // Averages row
    const avgComp = successful.reduce((s, r) => s + r.scorecard!.composite, 0) / successful.length;
    const avgA =
      successful.reduce((s, r) => s + r.scorecard!.categoryA.score, 0) / successful.length;
    const avgB =
      successful.reduce((s, r) => s + r.scorecard!.categoryB.score, 0) / successful.length;
    const avgC =
      successful.reduce((s, r) => s + r.scorecard!.categoryC.score, 0) / successful.length;
    const avgD =
      successful.reduce((s, r) => s + r.scorecard!.categoryD.score, 0) / successful.length;
    const avgE =
      successful.reduce((s, r) => s + r.scorecard!.categoryE.score, 0) / successful.length;
    const avgQA = successful.reduce((s, r) => s + (r.qaScore ?? 0), 0) / successful.length;
    const totalViolations = successful.reduce((s, r) => s + (r.violations?.length ?? 0), 0);

    console.log(
      `  ${'AVERAGE'.padEnd(30)}` +
        `${avgComp.toFixed(2).padStart(6)}` +
        `${avgA.toFixed(1).padStart(6)}` +
        `${avgB.toFixed(1).padStart(6)}` +
        `${avgC.toFixed(1).padStart(6)}` +
        `${avgD.toFixed(1).padStart(6)}` +
        `${avgE.toFixed(1).padStart(6)}` +
        `${avgQA.toFixed(0).padStart(6)}` +
        `${String(totalViolations).padStart(8)}`
    );

    // Coverage summary
    console.log('\n  USDA Fallback Coverage:');
    for (const r of successful) {
      if (!r.coverage) continue;
      const c = r.coverage;
      console.log(
        `    ${r.name.padEnd(32)} FS:${String(c.matchedFatSecret).padStart(3)} USDA:${String(c.matchedUSDA).padStart(3)} Unv:${String(c.unverified).padStart(3)} Total:${String(c.totalIngredients).padStart(3)} Match:${(c.totalMatchRate * 100).toFixed(1)}%`
      );
    }

    // Verification checklist
    console.log('\n  VERIFICATION CHECKLIST:');

    const allSucceeded = failed.length === 0;
    console.log(
      `    [${allSucceeded ? '✓' : '✗'}] All ${selectedPersonas.length} pipelines succeeded`
    );

    const anyUsda = successful.some((r) => r.coverage && r.coverage.matchedUSDA > 0);
    console.log(`    [${anyUsda ? '✓' : '✗'}] USDA fallback active (at least 1 usda- food ID)`);

    const restrictedPersonas = successful.filter((r) =>
      ['raj', 'jennifer', 'robert', 'takeshi'].includes(r.slug)
    );
    const allCompliant = restrictedPersonas.every(
      (r) => (r.violations?.filter((v) => v.type === 'allergen').length ?? 0) === 0
    );
    console.log(
      `    [${allCompliant ? '✓' : '✗'}] Dietary compliance: 0 allergen violations for restricted personas`
    );

    const avgIngPerMeal: number[] = [];
    for (const r of successful) {
      if (!r.scorecard) continue;
      // Re-derive from B notes
      const b1Note = r.scorecard.categoryB.notes.find((n) => n.startsWith('Avg'));
      if (b1Note) {
        const match = b1Note.match(/Avg ingredients\/meal: ([\d.]+)/);
        if (match) avgIngPerMeal.push(parseFloat(match[1]));
      }
    }
    const overallAvgIng =
      avgIngPerMeal.length > 0
        ? avgIngPerMeal.reduce((a, b) => a + b, 0) / avgIngPerMeal.length
        : 0;
    const ingRecovered = overallAvgIng >= 4 && overallAvgIng <= 8;
    console.log(
      `    [${ingRecovered ? '✓' : '✗'}] Ingredient count recovered: avg ${overallAvgIng.toFixed(1)} per non-snack meal (target 4-8)`
    );

    const avgKcalAdherence =
      successful.reduce((s, r) => s + (r.scorecard?.categoryA.subScores.a1 ?? 0), 0) /
      successful.length;
    const kcalGood = avgKcalAdherence >= 7;
    console.log(
      `    [${kcalGood ? '✓' : '✗'}] Calorie adherence: avg A1 sub-score ${avgKcalAdherence.toFixed(1)}/10`
    );

    const anyComplianceWarnings = successful.some((r) =>
      (r.qaAdjustments || []).some((a) => a.includes('[COMPLIANCE]'))
    );
    console.log(
      `    [${!anyComplianceWarnings ? '✓' : '~'}] QA compliance warnings: ${anyComplianceWarnings ? 'PRESENT' : 'none'}`
    );
  }

  // Save summary
  const summaryPath = resolve(OUTPUT_DIR, 'compliance-test-summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        successCount: successful.length,
        failCount: failed.length,
        results: allResults.map((r) => ({
          slug: r.slug,
          name: r.name,
          success: r.success,
          error: r.error,
          composite: r.scorecard?.composite,
          grade: r.scorecard?.grade,
          categoryScores: r.scorecard
            ? {
                A: r.scorecard.categoryA.score,
                B: r.scorecard.categoryB.score,
                C: r.scorecard.categoryC.score,
                D: r.scorecard.categoryD.score,
                E: r.scorecard.categoryE.score,
              }
            : undefined,
          violations: r.violations?.length ?? 0,
          allergenViolations: r.violations?.filter((v) => v.type === 'allergen').length ?? 0,
          dietaryViolations: r.violations?.filter((v) => v.type === 'dietary').length ?? 0,
          coverage: r.coverage,
          qaScore: r.qaScore,
          pipelineTimeMs: r.pipelineTimeMs,
        })),
        aggregates:
          successful.length > 0
            ? {
                avgComposite:
                  successful.reduce((s, r) => s + r.scorecard!.composite, 0) / successful.length,
                avgA:
                  successful.reduce((s, r) => s + r.scorecard!.categoryA.score, 0) /
                  successful.length,
                avgB:
                  successful.reduce((s, r) => s + r.scorecard!.categoryB.score, 0) /
                  successful.length,
                avgC:
                  successful.reduce((s, r) => s + r.scorecard!.categoryC.score, 0) /
                  successful.length,
                avgD:
                  successful.reduce((s, r) => s + r.scorecard!.categoryD.score, 0) /
                  successful.length,
                avgE:
                  successful.reduce((s, r) => s + r.scorecard!.categoryE.score, 0) /
                  successful.length,
                avgQA: successful.reduce((s, r) => s + (r.qaScore ?? 0), 0) / successful.length,
                totalViolations: successful.reduce((s, r) => s + (r.violations?.length ?? 0), 0),
                totalAllergenViolations: successful.reduce(
                  (s, r) => s + (r.violations?.filter((v) => v.type === 'allergen').length ?? 0),
                  0
                ),
                totalIngredients: successful.reduce(
                  (s, r) => s + (r.coverage?.totalIngredients ?? 0),
                  0
                ),
                totalFatSecret: successful.reduce(
                  (s, r) => s + (r.coverage?.matchedFatSecret ?? 0),
                  0
                ),
                totalUSDA: successful.reduce((s, r) => s + (r.coverage?.matchedUSDA ?? 0), 0),
                totalUnverified: successful.reduce((s, r) => s + (r.coverage?.unverified ?? 0), 0),
              }
            : undefined,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`\n  Summary saved: compliance-test-summary.json`);
  console.log(`${'='.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Compliance scoring test failed:', err);
  process.exit(1);
});
