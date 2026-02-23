import type { MealPlanDraft, DraftMeal } from '../../types/schemas';
import { convertToGrams } from '../../utils/unit-conversion';
import { engineLogger } from '../../utils/logger';

/**
 * Macro classification for an ingredient based on its dominant nutrient.
 */
type MacroClass = 'protein' | 'carb' | 'fat' | 'vegetable';

/**
 * USDA-sourced per-100g nutrition density reference table.
 * Used to classify ingredients and estimate macros from draft quantities.
 * Values represent cooked/prepared state where applicable.
 */
interface DensityEntry {
  keywords: string[];
  per100g: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  class: MacroClass;
}

const DENSITY_TABLE: DensityEntry[] = [
  // ── Protein-dominant ──
  {
    keywords: ['chicken breast'],
    per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    class: 'protein',
  },
  {
    keywords: ['chicken thigh'],
    per100g: { kcal: 209, proteinG: 26, carbsG: 0, fatG: 11 },
    class: 'protein',
  },
  {
    keywords: ['turkey breast'],
    per100g: { kcal: 135, proteinG: 30, carbsG: 0, fatG: 1 },
    class: 'protein',
  },
  {
    keywords: ['ground turkey', 'turkey mince'],
    per100g: { kcal: 170, proteinG: 27, carbsG: 0, fatG: 7 },
    class: 'protein',
  },
  {
    keywords: ['lean beef', 'ground beef', 'beef mince', 'sirloin'],
    per100g: { kcal: 250, proteinG: 26, carbsG: 0, fatG: 15 },
    class: 'protein',
  },
  {
    keywords: ['steak', 'flank steak', 'strip steak'],
    per100g: { kcal: 200, proteinG: 28, carbsG: 0, fatG: 9 },
    class: 'protein',
  },
  {
    keywords: ['salmon'],
    per100g: { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13 },
    class: 'protein',
  },
  {
    keywords: ['tuna'],
    per100g: { kcal: 130, proteinG: 28, carbsG: 0, fatG: 1 },
    class: 'protein',
  },
  {
    keywords: ['cod', 'tilapia', 'white fish', 'sole', 'haddock', 'halibut'],
    per100g: { kcal: 105, proteinG: 23, carbsG: 0, fatG: 1 },
    class: 'protein',
  },
  {
    keywords: ['shrimp', 'prawn'],
    per100g: { kcal: 99, proteinG: 24, carbsG: 0, fatG: 0.3 },
    class: 'protein',
  },
  {
    keywords: ['egg white'],
    per100g: { kcal: 52, proteinG: 11, carbsG: 0.7, fatG: 0.2 },
    class: 'protein',
  },
  {
    keywords: ['egg'],
    per100g: { kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11 },
    class: 'protein',
  },
  {
    keywords: ['tofu'],
    per100g: { kcal: 144, proteinG: 17, carbsG: 3, fatG: 9 },
    class: 'protein',
  },
  {
    keywords: ['tempeh'],
    per100g: { kcal: 192, proteinG: 20, carbsG: 8, fatG: 11 },
    class: 'protein',
  },
  {
    keywords: ['greek yogurt', 'greek yoghurt'],
    per100g: { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4 },
    class: 'protein',
  },
  {
    keywords: ['cottage cheese'],
    per100g: { kcal: 98, proteinG: 11, carbsG: 3.4, fatG: 4.3 },
    class: 'protein',
  },
  {
    keywords: ['pork loin', 'pork tenderloin'],
    per100g: { kcal: 143, proteinG: 26, carbsG: 0, fatG: 3.5 },
    class: 'protein',
  },
  {
    keywords: ['pork chop'],
    per100g: { kcal: 231, proteinG: 25, carbsG: 0, fatG: 14 },
    class: 'protein',
  },
  {
    keywords: ['lamb'],
    per100g: { kcal: 258, proteinG: 25, carbsG: 0, fatG: 17 },
    class: 'protein',
  },
  {
    keywords: ['whey protein', 'protein powder'],
    per100g: { kcal: 380, proteinG: 75, carbsG: 8, fatG: 4 },
    class: 'protein',
  },

  // ── Carb-dominant ──
  {
    keywords: ['rice', 'brown rice', 'white rice', 'basmati'],
    per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
    class: 'carb',
  },
  {
    keywords: ['quinoa'],
    per100g: { kcal: 120, proteinG: 4.4, carbsG: 21, fatG: 1.9 },
    class: 'carb',
  },
  {
    keywords: ['oats', 'oatmeal'],
    per100g: { kcal: 68, proteinG: 2.4, carbsG: 12, fatG: 1.4 },
    class: 'carb',
  },
  {
    keywords: ['pasta', 'spaghetti', 'penne', 'noodle'],
    per100g: { kcal: 131, proteinG: 5, carbsG: 25, fatG: 1.1 },
    class: 'carb',
  },
  {
    keywords: ['bread', 'toast', 'whole wheat bread'],
    per100g: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2 },
    class: 'carb',
  },
  {
    keywords: ['tortilla', 'wrap'],
    per100g: { kcal: 312, proteinG: 8, carbsG: 52, fatG: 8 },
    class: 'carb',
  },
  {
    keywords: ['potato', 'sweet potato'],
    per100g: { kcal: 86, proteinG: 1.7, carbsG: 20, fatG: 0.1 },
    class: 'carb',
  },
  {
    keywords: ['lentil'],
    per100g: { kcal: 116, proteinG: 9, carbsG: 20, fatG: 0.4 },
    class: 'carb',
  },
  {
    keywords: ['chickpea', 'garbanzo'],
    per100g: { kcal: 164, proteinG: 9, carbsG: 27, fatG: 2.6 },
    class: 'carb',
  },
  {
    keywords: ['black bean', 'kidney bean', 'bean'],
    per100g: { kcal: 132, proteinG: 9, carbsG: 24, fatG: 0.5 },
    class: 'carb',
  },
  {
    keywords: ['banana'],
    per100g: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 },
    class: 'carb',
  },
  {
    keywords: ['apple'],
    per100g: { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 },
    class: 'carb',
  },
  {
    keywords: ['berries', 'blueberry', 'strawberry', 'raspberry'],
    per100g: { kcal: 57, proteinG: 0.7, carbsG: 14, fatG: 0.3 },
    class: 'carb',
  },
  {
    keywords: ['honey', 'maple syrup'],
    per100g: { kcal: 304, proteinG: 0.3, carbsG: 82, fatG: 0 },
    class: 'carb',
  },
  {
    keywords: ['corn', 'corn kernel'],
    per100g: { kcal: 96, proteinG: 3.4, carbsG: 21, fatG: 1.5 },
    class: 'carb',
  },

  // ── Fat-dominant ──
  {
    keywords: [
      'olive oil',
      'coconut oil',
      'avocado oil',
      'vegetable oil',
      'canola oil',
      'sesame oil',
      'oil',
    ],
    per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
    class: 'fat',
  },
  {
    keywords: ['butter', 'ghee'],
    per100g: { kcal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81 },
    class: 'fat',
  },
  { keywords: ['avocado'], per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 }, class: 'fat' },
  {
    keywords: ['almond', 'almonds'],
    per100g: { kcal: 579, proteinG: 21, carbsG: 22, fatG: 50 },
    class: 'fat',
  },
  {
    keywords: ['walnut', 'walnuts'],
    per100g: { kcal: 654, proteinG: 15, carbsG: 14, fatG: 65 },
    class: 'fat',
  },
  {
    keywords: ['peanut butter', 'almond butter', 'nut butter'],
    per100g: { kcal: 588, proteinG: 25, carbsG: 20, fatG: 50 },
    class: 'fat',
  },
  {
    keywords: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta'],
    per100g: { kcal: 350, proteinG: 25, carbsG: 1.3, fatG: 28 },
    class: 'fat',
  },
  {
    keywords: ['cream cheese'],
    per100g: { kcal: 342, proteinG: 6, carbsG: 4, fatG: 34 },
    class: 'fat',
  },
  {
    keywords: ['heavy cream', 'cream'],
    per100g: { kcal: 340, proteinG: 2, carbsG: 3, fatG: 36 },
    class: 'fat',
  },
  {
    keywords: ['coconut milk'],
    per100g: { kcal: 230, proteinG: 2.3, carbsG: 6, fatG: 24 },
    class: 'fat',
  },
  {
    keywords: ['bacon'],
    per100g: { kcal: 541, proteinG: 37, carbsG: 1.4, fatG: 42 },
    class: 'fat',
  },
  {
    keywords: ['pecan', 'pecans'],
    per100g: { kcal: 691, proteinG: 9, carbsG: 14, fatG: 72 },
    class: 'fat',
  },
  {
    keywords: ['macadamia'],
    per100g: { kcal: 718, proteinG: 8, carbsG: 14, fatG: 76 },
    class: 'fat',
  },
  {
    keywords: ['seed', 'chia', 'flax', 'pumpkin seed', 'sunflower seed'],
    per100g: { kcal: 486, proteinG: 17, carbsG: 42, fatG: 31 },
    class: 'fat',
  },

  // ── Vegetables (never adjusted) ──
  {
    keywords: ['broccoli'],
    per100g: { kcal: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4 },
    class: 'vegetable',
  },
  {
    keywords: ['spinach'],
    per100g: { kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 },
    class: 'vegetable',
  },
  {
    keywords: ['kale'],
    per100g: { kcal: 49, proteinG: 4.3, carbsG: 9, fatG: 0.9 },
    class: 'vegetable',
  },
  {
    keywords: ['cauliflower'],
    per100g: { kcal: 25, proteinG: 1.9, carbsG: 5, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['zucchini', 'courgette'],
    per100g: { kcal: 17, proteinG: 1.2, carbsG: 3.1, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['bell pepper', 'pepper', 'capsicum'],
    per100g: { kcal: 31, proteinG: 1, carbsG: 6, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['tomato'],
    per100g: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 },
    class: 'vegetable',
  },
  {
    keywords: ['onion'],
    per100g: { kcal: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1 },
    class: 'vegetable',
  },
  {
    keywords: ['garlic'],
    per100g: { kcal: 149, proteinG: 6.4, carbsG: 33, fatG: 0.5 },
    class: 'vegetable',
  },
  {
    keywords: ['mushroom'],
    per100g: { kcal: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['cucumber'],
    per100g: { kcal: 16, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 },
    class: 'vegetable',
  },
  {
    keywords: ['carrot'],
    per100g: { kcal: 41, proteinG: 0.9, carbsG: 10, fatG: 0.2 },
    class: 'vegetable',
  },
  {
    keywords: ['lettuce', 'romaine', 'arugula', 'greens'],
    per100g: { kcal: 15, proteinG: 1.4, carbsG: 2.9, fatG: 0.2 },
    class: 'vegetable',
  },
  {
    keywords: ['asparagus'],
    per100g: { kcal: 20, proteinG: 2.2, carbsG: 3.9, fatG: 0.1 },
    class: 'vegetable',
  },
  {
    keywords: ['green bean', 'string bean'],
    per100g: { kcal: 31, proteinG: 1.8, carbsG: 7, fatG: 0.1 },
    class: 'vegetable',
  },
  {
    keywords: ['celery'],
    per100g: { kcal: 16, proteinG: 0.7, carbsG: 3, fatG: 0.2 },
    class: 'vegetable',
  },
  {
    keywords: ['cabbage'],
    per100g: { kcal: 25, proteinG: 1.3, carbsG: 6, fatG: 0.1 },
    class: 'vegetable',
  },

  // ── Keto alternatives (used for swaps) ──
  {
    keywords: ['cauliflower rice'],
    per100g: { kcal: 25, proteinG: 1.9, carbsG: 5, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['zucchini noodle', 'zoodle'],
    per100g: { kcal: 17, proteinG: 1.2, carbsG: 3.1, fatG: 0.3 },
    class: 'vegetable',
  },
  {
    keywords: ['lettuce wrap'],
    per100g: { kcal: 15, proteinG: 1.4, carbsG: 2.9, fatG: 0.2 },
    class: 'vegetable',
  },
  {
    keywords: ['turnip'],
    per100g: { kcal: 28, proteinG: 0.9, carbsG: 6.4, fatG: 0.1 },
    class: 'vegetable',
  },
];

/**
 * Keto ingredient swap table: high-carb staple → keto alternative.
 */
const KETO_SWAPS: Array<{ patterns: string[]; replacement: { name: string; unit: string } }> = [
  {
    patterns: ['rice', 'brown rice', 'white rice', 'basmati', 'jasmine rice'],
    replacement: { name: 'cauliflower rice', unit: 'g' },
  },
  {
    patterns: ['pasta', 'spaghetti', 'penne', 'noodle', 'linguine', 'fettuccine'],
    replacement: { name: 'zucchini noodles', unit: 'g' },
  },
  {
    patterns: ['potato', 'sweet potato', 'potatoes', 'sweet potatoes'],
    replacement: { name: 'turnip', unit: 'g' },
  },
  {
    patterns: ['bread', 'toast', 'bun', 'roll', 'pita'],
    replacement: { name: 'lettuce wrap', unit: 'pieces' },
  },
  {
    patterns: ['tortilla', 'wrap', 'flatbread'],
    replacement: { name: 'lettuce wrap', unit: 'pieces' },
  },
  {
    patterns: ['oats', 'oatmeal', 'cereal', 'granola'],
    replacement: { name: 'chia seeds', unit: 'g' },
  },
  { patterns: ['corn', 'corn kernel'], replacement: { name: 'zucchini', unit: 'g' } },
];

/**
 * Look up an ingredient's density entry from the reference table.
 * Returns the first matching entry or undefined.
 */
function lookupDensity(ingredientName: string): DensityEntry | undefined {
  const lower = ingredientName.toLowerCase();
  // Try longest-keyword matches first for specificity
  for (const entry of DENSITY_TABLE) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry;
    }
  }
  return undefined;
}

/**
 * Classify an ingredient by its dominant macronutrient.
 */
function classifyIngredient(ingredientName: string): MacroClass {
  const entry = lookupDensity(ingredientName);
  return entry?.class ?? 'vegetable'; // unknown ingredients treated as vegetable (not adjusted)
}

interface IngredientWithMacros {
  index: number;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  macroClass: MacroClass;
  estimatedProteinG: number;
  estimatedCarbsG: number;
  estimatedFatG: number;
  estimatedKcal: number;
  density: DensityEntry | undefined;
}

/**
 * Analyze a meal's draft ingredients, estimate macros from the density table.
 */
function analyzeMealIngredients(meal: DraftMeal): IngredientWithMacros[] {
  return meal.draftIngredients.map((ing, idx) => {
    const grams = convertToGrams(ing.quantity, ing.unit);
    const density = lookupDensity(ing.name);
    const macroClass = density?.class ?? 'vegetable';

    let estimatedProteinG = 0;
    let estimatedCarbsG = 0;
    let estimatedFatG = 0;
    let estimatedKcal = 0;

    if (density) {
      const scale = grams / 100;
      estimatedProteinG = density.per100g.proteinG * scale;
      estimatedCarbsG = density.per100g.carbsG * scale;
      estimatedFatG = density.per100g.fatG * scale;
      estimatedKcal = density.per100g.kcal * scale;
    }

    return {
      index: idx,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      grams,
      macroClass,
      estimatedProteinG,
      estimatedCarbsG,
      estimatedFatG,
      estimatedKcal,
      density,
    };
  });
}

/** Minimum / maximum scale factor per ingredient to prevent unrealistic portions. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

/**
 * Correct a single meal's ingredient quantities to hit macro targets.
 * Only adjusts quantities, never changes which ingredients are used.
 * Vegetables are never adjusted.
 */
function correctMealMacros(meal: DraftMeal, analyzed: IngredientWithMacros[]): DraftMeal {
  const target = meal.targetNutrition;

  // Sum estimated macros from density table
  let estProtein = 0,
    estCarbs = 0,
    estFat = 0;
  for (const a of analyzed) {
    estProtein += a.estimatedProteinG;
    estCarbs += a.estimatedCarbsG;
    estFat += a.estimatedFatG;
  }

  // If we couldn't estimate anything (no density matches), skip correction
  if (estProtein === 0 && estCarbs === 0 && estFat === 0) {
    return meal;
  }

  const corrections: Array<{ macro: 'protein' | 'carb' | 'fat'; factor: number }> = [];

  // Check each macro against 15% tolerance
  if (target.proteinG > 0 && estProtein > 0) {
    const ratio = estProtein / target.proteinG;
    if (Math.abs(ratio - 1) > 0.15) {
      corrections.push({ macro: 'protein', factor: target.proteinG / estProtein });
    }
  }
  if (target.carbsG > 0 && estCarbs > 0) {
    const ratio = estCarbs / target.carbsG;
    if (Math.abs(ratio - 1) > 0.15) {
      corrections.push({ macro: 'carb', factor: target.carbsG / estCarbs });
    }
  }
  if (target.fatG > 0 && estFat > 0) {
    const ratio = estFat / target.fatG;
    if (Math.abs(ratio - 1) > 0.15) {
      corrections.push({ macro: 'fat', factor: target.fatG / estFat });
    }
  }

  if (corrections.length === 0) return meal;

  // Apply corrections to matching ingredient categories
  const adjustedIngredients = [...meal.draftIngredients];

  for (const { macro, factor } of corrections) {
    const clampedFactor = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factor));

    for (const a of analyzed) {
      if (a.macroClass === 'vegetable') continue; // never adjust vegetables
      if (
        a.macroClass !== macro &&
        !(macro === 'protein' && a.macroClass === 'protein') &&
        !(macro === 'carb' && a.macroClass === 'carb') &&
        !(macro === 'fat' && a.macroClass === 'fat')
      )
        continue;

      const original = adjustedIngredients[a.index];
      adjustedIngredients[a.index] = {
        ...original,
        quantity: Math.round(original.quantity * clampedFactor * 10) / 10,
      };
    }
  }

  // Recalculate estimated nutrition from corrected quantities
  let newKcal = 0,
    newProtein = 0,
    newCarbs = 0,
    newFat = 0;
  for (let i = 0; i < adjustedIngredients.length; i++) {
    const ing = adjustedIngredients[i];
    const density = lookupDensity(ing.name);
    if (density) {
      const grams = convertToGrams(ing.quantity, ing.unit);
      const scale = grams / 100;
      newProtein += density.per100g.proteinG * scale;
      newCarbs += density.per100g.carbsG * scale;
      newFat += density.per100g.fatG * scale;
      newKcal += density.per100g.kcal * scale;
    } else {
      // Use proportion from original analyzed entry
      newProtein += analyzed[i].estimatedProteinG;
      newCarbs += analyzed[i].estimatedCarbsG;
      newFat += analyzed[i].estimatedFatG;
      newKcal += analyzed[i].estimatedKcal;
    }
  }

  return {
    ...meal,
    draftIngredients: adjustedIngredients,
    estimatedNutrition: {
      kcal: Math.round(newKcal),
      proteinG: Math.round(newProtein * 10) / 10,
      carbsG: Math.round(newCarbs * 10) / 10,
      fatG: Math.round(newFat * 10) / 10,
    },
  };
}

/**
 * Layer 3A: Keto carb gate — swap high-carb staples with keto alternatives.
 * Runs after general macro correction for keto plans only.
 */
function applyKetoSwaps(meal: DraftMeal, _dailyCarbTarget: number): DraftMeal {
  let swapsMade = false;
  const swappedIngredients = meal.draftIngredients.map((ing) => {
    const lower = ing.name.toLowerCase();
    for (const swap of KETO_SWAPS) {
      if (swap.patterns.some((p) => lower.includes(p))) {
        engineLogger.info(
          `[DraftMacroCorrector] Keto swap: "${ing.name}" → "${swap.replacement.name}"`
        );
        swapsMade = true;
        return {
          ...ing,
          name: swap.replacement.name,
          unit: swap.replacement.unit === 'pieces' ? 'pieces' : ing.unit,
          quantity:
            swap.replacement.unit === 'pieces'
              ? Math.max(1, Math.round(ing.quantity / 50))
              : ing.quantity,
        };
      }
    }
    return ing;
  });

  if (!swapsMade) return meal;

  // Recalculate estimated nutrition after swaps
  let newKcal = 0,
    newProtein = 0,
    newCarbs = 0,
    newFat = 0;
  for (const ing of swappedIngredients) {
    const density = lookupDensity(ing.name);
    if (density) {
      const grams = convertToGrams(ing.quantity, ing.unit);
      const scale = grams / 100;
      newProtein += density.per100g.proteinG * scale;
      newCarbs += density.per100g.carbsG * scale;
      newFat += density.per100g.fatG * scale;
      newKcal += density.per100g.kcal * scale;
    }
  }

  return {
    ...meal,
    draftIngredients: swappedIngredients,
    estimatedNutrition: {
      kcal: Math.round(newKcal) || meal.estimatedNutrition.kcal,
      proteinG: Math.round(newProtein * 10) / 10 || meal.estimatedNutrition.proteinG,
      carbsG: Math.round(newCarbs * 10) / 10 || meal.estimatedNutrition.carbsG,
      fatG: Math.round(newFat * 10) / 10 || meal.estimatedNutrition.fatG,
    },
  };
}

/**
 * Post-draft macro correction for an entire meal plan.
 * Deterministically adjusts ingredient quantities so macros align with targets.
 *
 * @param draft - The raw MealPlanDraft from Claude
 * @param macroStyle - The client's macro style (e.g., 'keto', 'high_protein')
 * @param dailyCarbTarget - Daily carb target in grams (used for keto gate)
 * @returns Corrected draft with adjusted ingredient quantities
 */
export function correctDraftMacros(
  draft: MealPlanDraft,
  macroStyle?: string,
  dailyCarbTarget?: number
): MealPlanDraft {
  let totalCorrections = 0;
  let totalKetoSwaps = 0;

  const correctedDays = draft.days.map((day) => {
    const correctedMeals = day.meals.map((meal) => {
      if (!meal.draftIngredients || meal.draftIngredients.length === 0) return meal;

      // Step 1: Analyze and correct macros
      const analyzed = analyzeMealIngredients(meal);
      let corrected = correctMealMacros(meal, analyzed);

      // Check if correction was applied
      if (corrected !== meal) totalCorrections++;

      // Step 2: Keto swaps (Layer 3A) — only for keto plans
      if (macroStyle === 'keto' && dailyCarbTarget !== undefined) {
        const beforeSwap = corrected;
        corrected = applyKetoSwaps(corrected, dailyCarbTarget);
        if (corrected !== beforeSwap) totalKetoSwaps++;
      }

      return corrected;
    });

    return { ...day, meals: correctedMeals };
  });

  if (totalCorrections > 0 || totalKetoSwaps > 0) {
    engineLogger.info(
      `[DraftMacroCorrector] Corrected ${totalCorrections} meals, ${totalKetoSwaps} keto swaps across ${draft.days.length} days`
    );
  }

  return { ...draft, days: correctedDays };
}

// Export for testing
export { lookupDensity, classifyIngredient, analyzeMealIngredients, DENSITY_TABLE };
