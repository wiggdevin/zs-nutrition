import type { PlanDay, Meal } from './types';

// --- Types ---

export interface PrepGroup {
  protein: string;
  meals: Array<{ dayNumber: number; slot: string; name: string }>;
  totalServings: number;
  estimatedPrepMin: number;
  estimatedCookMin: number;
}

export interface PrepStep {
  step: number;
  action: string;
  duration: number;
  type: 'prep' | 'cook' | 'rest';
  parallel: boolean;
  group: string;
}

export interface ConsolidatedIngredient {
  name: string;
  totalAmount: number;
  unit: string;
}

// --- Constants ---

const PROTEIN_KEYWORDS = [
  'chicken',
  'beef',
  'salmon',
  'tofu',
  'turkey',
  'pork',
  'shrimp',
  'fish',
  'eggs',
  'egg',
  'tempeh',
  'lentils',
  'tuna',
  'cod',
  'tilapia',
  'steak',
  'ground beef',
  'ground turkey',
] as const;

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- Functions ---

/**
 * Extract the primary protein from a meal's ingredients by checking common protein keywords.
 */
function extractProtein(meal: Meal): string {
  const ingredients = meal.ingredients ?? [];
  for (const ing of ingredients) {
    const lower = ing.name.toLowerCase();
    for (const keyword of PROTEIN_KEYWORDS) {
      if (lower.includes(keyword)) {
        // Capitalize first letter
        return keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
    }
  }
  // Fallback: check meal name
  const mealNameLower = meal.name.toLowerCase();
  for (const keyword of PROTEIN_KEYWORDS) {
    if (mealNameLower.includes(keyword)) {
      return keyword.charAt(0).toUpperCase() + keyword.slice(1);
    }
  }
  return 'Other';
}

/**
 * Group meals by primary protein for batch cooking.
 */
export function groupByProtein(days: PlanDay[]): PrepGroup[] {
  const groupMap = new Map<string, PrepGroup>();

  for (const day of days) {
    for (const meal of day.meals) {
      const protein = extractProtein(meal);
      const existing = groupMap.get(protein);

      if (existing) {
        existing.meals.push({
          dayNumber: day.dayNumber,
          slot: meal.slot,
          name: meal.name,
        });
        existing.totalServings += 1;
        existing.estimatedPrepMin += meal.prepTimeMin ?? 10;
        existing.estimatedCookMin += meal.cookTimeMin ?? 15;
      } else {
        groupMap.set(protein, {
          protein,
          meals: [{ dayNumber: day.dayNumber, slot: meal.slot, name: meal.name }],
          totalServings: 1,
          estimatedPrepMin: meal.prepTimeMin ?? 10,
          estimatedCookMin: meal.cookTimeMin ?? 15,
        });
      }
    }
  }

  // For batch cooking, reduce times since you prep/cook together
  for (const group of groupMap.values()) {
    if (group.totalServings > 1) {
      // Batch prep is more efficient: ~60% of summed individual times
      group.estimatedPrepMin = Math.round(group.estimatedPrepMin * 0.6);
      group.estimatedCookMin = Math.round(group.estimatedCookMin * 0.6);
    }
  }

  return Array.from(groupMap.values()).sort((a, b) => b.totalServings - a.totalServings);
}

/**
 * Build a step-by-step prep timeline from groups.
 * Returns steps with estimated times and parallel task indicators.
 */
export function buildPrepTimeline(groups: PrepGroup[]): PrepStep[] {
  const steps: PrepStep[] = [];
  let stepNum = 1;

  for (const group of groups) {
    if (group.protein === 'Other') continue;

    const mealList = group.meals
      .map(
        (m) =>
          `${DAY_NAMES[m.dayNumber] || `Day ${m.dayNumber}`} ${m.slot.replace(/_\d+$/, '').replace(/^(\w)(.*)$/, (_, f: string, r: string) => f + r.toLowerCase())}`
      )
      .join(', ');

    // Prep step
    steps.push({
      step: stepNum++,
      action: `Prep ${group.protein.toLowerCase()} for ${mealList} (${group.totalServings} servings)`,
      duration: group.estimatedPrepMin,
      type: 'prep',
      parallel: false,
      group: group.protein,
    });

    // Cook step
    steps.push({
      step: stepNum++,
      action: `Cook ${group.protein.toLowerCase()} batch (${group.totalServings} servings)`,
      duration: group.estimatedCookMin,
      type: 'cook',
      parallel: false,
      group: group.protein,
    });

    // Rest step for meats
    const meatProteins = ['chicken', 'beef', 'turkey', 'pork', 'steak'];
    if (meatProteins.some((m) => group.protein.toLowerCase().includes(m))) {
      steps.push({
        step: stepNum++,
        action: `Rest ${group.protein.toLowerCase()} before portioning`,
        duration: 10,
        type: 'rest',
        parallel: true,
        group: group.protein,
      });
    }
  }

  // Handle "Other" group if it exists
  const otherGroup = groups.find((g) => g.protein === 'Other');
  if (otherGroup && otherGroup.meals.length > 0) {
    steps.push({
      step: stepNum++,
      action: `Prep remaining meals (${otherGroup.totalServings} servings)`,
      duration: otherGroup.estimatedPrepMin + otherGroup.estimatedCookMin,
      type: 'prep',
      parallel: false,
      group: 'Other',
    });
  }

  // Mark adjacent cook/rest steps as parallelizable with next prep step
  for (let i = 0; i < steps.length - 1; i++) {
    if (
      (steps[i].type === 'cook' || steps[i].type === 'rest') &&
      steps[i + 1].type === 'prep' &&
      steps[i].group !== steps[i + 1].group
    ) {
      steps[i].parallel = true;
      steps[i + 1].parallel = true;
    }
  }

  return steps;
}

/**
 * Merge duplicate ingredients across grouped meals.
 * Case-insensitive dedup by ingredient name + unit, sum amounts.
 */
export function consolidateIngredients(meals: Meal[]): ConsolidatedIngredient[] {
  const map = new Map<string, ConsolidatedIngredient>();

  for (const meal of meals) {
    for (const ing of meal.ingredients ?? []) {
      const normalizedName = ing.name.trim().toLowerCase();
      const normalizedUnit = (ing.unit ?? '').trim().toLowerCase();
      const key = `${normalizedName}|${normalizedUnit}`;
      const amount =
        typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 0;

      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += amount;
      } else {
        map.set(key, {
          name: ing.name.trim(),
          totalAmount: amount,
          unit: (ing.unit ?? '').trim(),
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
