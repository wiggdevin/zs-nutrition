import pLimit from 'p-limit';
import {
  MealPlanDraft,
  MealPlanCompiled,
  MealPlanCompiledSchema,
  CompiledMeal,
  CompiledDay,
  DraftMeal,
  DraftDay,
  Ingredient,
  ClientIntake,
} from '../../types/schemas';
import { FatSecretAdapter } from '../../adapters/fatsecret';
import { USDAAdapter } from '../../adapters/usda';
import { LocalUSDAAdapter } from '../../adapters/usda-local';
import { engineLogger } from '../../utils/logger';
import { isProductCompliant } from '../../utils/dietary-compliance';
import {
  buildIngredientsFromFood,
  generateEstimatedIngredients,
  generateInstructions,
} from './ingredient-builder';
import type { FoodServing, FoodDetails, FoodSearchResult } from '../../adapters/food-data-types';
import type { FoodAliasCache } from '../../data/food-alias-cache';

/** Nutrition data after scaling to target kcal */
interface ScaledNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | undefined;
}

/** Maximum concurrent food data API calls to respect rate limits */
const API_CONCURRENCY_LIMIT = 5;

/**
 * Maximum scale factor before falling back to AI estimates.
 * If a FatSecret serving needs >8x scaling to reach target kcal,
 * the match is likely a single ingredient (not a full meal) and
 * the scaled macro ratios become unreliable.
 */
const MAX_SCALE_FACTOR = 8.0;

/**
 * Minimum scale factor floor. Prevents absurd downscaling.
 */
const MIN_SCALE_FACTOR = 0.25;

/** Derive calories from macros using standard Atwater factors (4/4/9). */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/** Concurrency limit for ingredient-level lookups (higher than meal-level) */
const INGREDIENT_CONCURRENCY_LIMIT = 8;

/** Recalibration: only activate if actual kcal diverges from target by more than this fraction */
const RECALIBRATION_THRESHOLD = 0.05;

/** Recalibration: minimum scale factor (don't shrink portions below 50%) */
const MIN_RECALIBRATION_FACTOR = 0.5;

/** Recalibration: maximum scale factor (don't inflate portions above 200%) */
const MAX_RECALIBRATION_FACTOR = 2.0;

/**
 * Convert a quantity + unit to grams for per-100g scaling.
 */
function convertToGrams(quantity: number, unit: string): number {
  const u = unit.toLowerCase().trim();
  switch (u) {
    case 'g':
    case 'grams':
    case 'gram':
      return quantity;
    case 'oz':
    case 'ounce':
    case 'ounces':
      return quantity * 28.35;
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      return quantity * 453.6;
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return quantity * 1000;
    case 'cup':
    case 'cups':
      return quantity * 240;
    case 'tbsp':
    case 'tablespoon':
    case 'tablespoons':
      return quantity * 15;
    case 'tsp':
    case 'teaspoon':
    case 'teaspoons':
      return quantity * 5;
    case 'ml':
    case 'milliliter':
    case 'milliliters':
      return quantity;
    case 'pieces':
    case 'piece':
    case 'count':
    case 'large':
    case 'medium':
    case 'small':
    case 'slices':
    case 'slice':
      return quantity * 50;
    default:
      return quantity * 100;
  }
}

// INGREDIENT_NAME_MAP has been migrated to the FoodAlias database table.
// See seed-food-aliases.ts for the data and FoodAliasCache for runtime lookups.

/**
 * Density map for converting ml-based FatSecret servings to gram equivalents.
 * Used when metricServingUnit is 'ml' (common for oils, butter, syrups, liquids).
 */
const ML_TO_GRAM_DENSITY: { keywords: string[]; density: number }[] = [
  {
    keywords: [
      'oil',
      'olive oil',
      'sesame oil',
      'coconut oil',
      'vegetable oil',
      'canola oil',
      'avocado oil',
      'sunflower oil',
      'peanut oil',
    ],
    density: 0.92,
  },
  { keywords: ['butter', 'ghee', 'clarified butter'], density: 0.91 },
  { keywords: ['honey', 'maple syrup', 'corn syrup', 'agave', 'molasses', 'syrup'], density: 1.42 },
  { keywords: ['milk', 'cream', 'half and half', 'yogurt', 'kefir', 'buttermilk'], density: 1.03 },
  {
    keywords: [
      'water',
      'vinegar',
      'broth',
      'stock',
      'lemon juice',
      'lime juice',
      'soy sauce',
      'fish sauce',
      'worcestershire',
      'hot sauce',
      'juice',
      'wine',
      'mirin',
      'sake',
    ],
    density: 1.0,
  },
];

function estimateDensityForFood(foodName: string): number {
  const lower = foodName.toLowerCase();
  for (const entry of ML_TO_GRAM_DENSITY) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.density;
    }
  }
  return 1.0; // safe default
}

/**
 * Keywords that indicate a cooking/preparation state.
 * Used to prefer FatSecret results matching the same state as the search term.
 */
const COOKING_STATE_KEYWORDS = [
  'cooked',
  'raw',
  'baked',
  'roasted',
  'grilled',
  'steamed',
  'boiled',
  'fried',
  'dried',
  'canned',
];

/**
 * Extract the first cooking-state keyword from a food name, or null if none found.
 */
function extractCookingState(name: string): string | null {
  const lower = name.toLowerCase();
  for (const kw of COOKING_STATE_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

/**
 * Maximum kcal/g for cooked foods. Cooked grains/legumes absorb water → ~1.0-1.8 kcal/g.
 * Dry versions are ~3.0-4.0 kcal/g. If a search says "cooked" but the result exceeds this
 * ceiling, we're likely matching dry data for a cooked food — skip it.
 */
const COOKED_KCAL_PER_GRAM_CEILING = 2.5;

/** Result of normalizing an ingredient name */
interface NormalizedIngredient {
  searchName: string;
  fdcId?: number;
}

/**
 * Normalize an ingredient name to improve search hit rate.
 * Uses FoodAliasCache (database-driven) when available, falls back to plain cleaning.
 * Returns an array (usually 1 item; multiple for compound names like "Apple + Peanut Butter").
 */
function normalizeIngredientName(
  name: string,
  aliasCache?: FoodAliasCache
): NormalizedIngredient[] {
  const trimmed = name.trim().toLowerCase();

  // Check alias cache for exact match
  if (aliasCache) {
    const entry = aliasCache.get(trimmed);
    if (entry) {
      return [{ searchName: entry.canonicalName, fdcId: entry.fdcId }];
    }
  }

  // Remove commas (fixes "tuna, canned in water" → "tuna canned in water")
  let cleaned = trimmed.replace(/,/g, '');

  // Strip leading quantities/units leaked into name (e.g. "2 cups spinach" → "spinach")
  cleaned = cleaned.replace(
    /^\d+(\.\d+)?\s*(g|oz|cups?|tbsp|tsp|ml|lbs?|kg|pieces?|slices?|large|medium|small)\s+/i,
    ''
  );

  // Split compound names on " + " or " and " (e.g. "Apple + Peanut Butter" → ["apple", "peanut butter"])
  if (/\s\+\s|\sand\s/i.test(cleaned)) {
    const parts = cleaned
      .split(/\s\+\s|\sand\s/i)
      .map((p) => p.trim())
      .filter(Boolean);
    // Recursively normalize each part
    return parts.flatMap((part) => normalizeIngredientName(part, aliasCache));
  }

  // Check alias cache again after cleaning
  if (aliasCache) {
    const entry = aliasCache.get(cleaned);
    if (entry) {
      return [{ searchName: entry.canonicalName, fdcId: entry.fdcId }];
    }
  }

  return [{ searchName: cleaned }];
}

/**
 * Agent 4: Nutrition Compiler
 * Verifies nutrition via USDA (primary) and FatSecret (fallback) APIs,
 * gets full recipes, scales portions.
 * Tags meals as "verified" or "ai_estimated" based on food database match.
 *
 * Performance optimization: Uses p-limit to parallelize API calls
 * with a concurrency limit to respect rate limits.
 */
export class NutritionCompiler {
  private readonly limit = pLimit(API_CONCURRENCY_LIMIT);

  constructor(
    private usdaAdapter: USDAAdapter,
    private fatSecretAdapter?: FatSecretAdapter,
    private localUsdaAdapter?: LocalUSDAAdapter,
    private aliasCache?: FoodAliasCache
  ) {}

  async compile(
    draft: MealPlanDraft,
    clientIntake?: ClientIntake,
    onSubProgress?: (message: string) => void | Promise<void>
  ): Promise<MealPlanCompiled> {
    const startTime = Date.now();
    engineLogger.info('[NutritionCompiler] Starting compilation with parallel processing');

    const totalMeals = draft.days.reduce((sum, d) => sum + d.meals.length, 0);
    let mealsProcessed = 0;

    // Process all days in parallel (each day's meals are processed concurrently with rate limiting)
    const compiledDays = await Promise.all(
      draft.days.map(async (day) => {
        const compiled = await this.compileDay(day, clientIntake);
        mealsProcessed += day.meals.length;
        // Emit sub-progress every 5 meals
        if (mealsProcessed % 5 === 0 || mealsProcessed === totalMeals) {
          await onSubProgress?.(`Verifying meal ${mealsProcessed} of ${totalMeals}...`);
        }
        return compiled;
      })
    );

    // Calculate weekly averages
    const weeklyAverages = this.calculateWeeklyAverages(compiledDays);

    const result: MealPlanCompiled = {
      days: compiledDays,
      weeklyAverages,
    };

    const elapsedMs = Date.now() - startTime;
    engineLogger.info(`[NutritionCompiler] Compilation completed in ${elapsedMs}ms`);

    // Validate against schema
    return MealPlanCompiledSchema.parse(result);
  }

  /**
   * Compile a single day's meals concurrently with rate limiting.
   */
  private async compileDay(day: DraftDay, clientIntake?: ClientIntake): Promise<CompiledDay> {
    // Process all meals in this day concurrently, limited by p-limit
    const compiledMeals = await Promise.all(
      day.meals.map((meal) =>
        this.limit(() => this.compileMeal(meal, day.targetKcal, clientIntake))
      )
    );

    // Calculate daily totals
    const dailyTotals = this.calculateDailyTotals(compiledMeals);

    // Calculate variance from target
    const varianceKcal = dailyTotals.kcal - day.targetKcal;
    const variancePercent =
      day.targetKcal > 0 ? Math.round((varianceKcal / day.targetKcal) * 10000) / 100 : 0;

    // Derive per-day macro targets by summing each meal's target nutrition
    const macroTargets = {
      proteinG: Math.round(day.meals.reduce((sum, m) => sum + m.targetNutrition.proteinG, 0)),
      carbsG: Math.round(day.meals.reduce((sum, m) => sum + m.targetNutrition.carbsG, 0)),
      fatG: Math.round(day.meals.reduce((sum, m) => sum + m.targetNutrition.fatG, 0)),
    };

    const result: CompiledDay = {
      dayNumber: day.dayNumber,
      dayName: day.dayName,
      isTrainingDay: day.isTrainingDay,
      targetKcal: day.targetKcal,
      macroTargets,
      meals: compiledMeals,
      dailyTotals,
      varianceKcal: Math.round(varianceKcal),
      variancePercent,
    };

    return this.calibrateDay(result);
  }

  /**
   * Select the best serving from a food's serving list.
   * Picks the serving with the highest calories to minimize scaling needed,
   * which produces more realistic macro ratios.
   */
  private selectBestServing(servings: FoodServing[], targetKcal: number): FoodServing {
    if (servings.length === 1) return servings[0];

    // Pick the serving whose calorie count is closest to the target without
    // exceeding it too much. If none are close, pick the highest-calorie serving
    // to minimize the scale factor.
    let best = servings[0];
    let bestScore = -Infinity;

    for (const s of servings) {
      if (s.calories <= 0) continue;

      // Prefer servings that minimize the required scale factor
      // Ideal: scale factor of 1.0 (serving matches target exactly)
      const ratio = targetKcal / s.calories;
      // Score: closer to 1.0 is better; penalize both over and under
      const score = -Math.abs(Math.log(ratio));

      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }

    return best;
  }

  /**
   * Select the best serving for gram-based scaling (ingredient-level path).
   * Only considers servings with valid gram metadata to avoid the `|| 100` fallback bug.
   * Returns null if no serving has usable gram data, forcing a fallback.
   */
  private selectBestServingForGrams(
    servings: FoodServing[],
    gramsNeeded: number,
    foodName?: string
  ): { serving: FoodServing; servingGrams: number; wasMLConverted: boolean } | null {
    // Gram-based servings (existing)
    const withGrams = servings.filter(
      (s) => s.metricServingAmount && s.metricServingAmount > 0 && s.metricServingUnit === 'g'
    );

    // ml-based servings converted to gram equivalents
    const density = foodName ? estimateDensityForFood(foodName) : 1.0;
    const mlConverted = servings
      .filter(
        (s) => s.metricServingAmount && s.metricServingAmount > 0 && s.metricServingUnit === 'ml'
      )
      .map((s) => ({ serving: s, servingGrams: s.metricServingAmount! * density }));

    // Combined candidate pool — track which pool each candidate came from
    const candidates: { serving: FoodServing; servingGrams: number; wasMLConverted: boolean }[] = [
      ...withGrams.map((s) => ({
        serving: s,
        servingGrams: s.metricServingAmount!,
        wasMLConverted: false,
      })),
      ...mlConverted.map((s) => ({ ...s, wasMLConverted: true })),
    ];

    if (candidates.length > 0) {
      let best = candidates[0];
      let bestScore = -Infinity;
      for (const c of candidates) {
        const score = -Math.abs(Math.log(gramsNeeded / c.servingGrams));
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      return {
        serving: best.serving,
        servingGrams: best.servingGrams,
        wasMLConverted: best.wasMLConverted,
      };
    }

    // No gram metadata — try to find a "per 100g" by description
    const per100gByDesc = servings.find(
      (s) =>
        s.servingDescription.toLowerCase().includes('100g') ||
        s.servingDescription.toLowerCase().includes('100 g')
    );
    if (per100gByDesc) {
      return { serving: per100gByDesc, servingGrams: 100, wasMLConverted: false };
    }

    // No usable gram data at all
    return null;
  }

  /**
   * Reorder search results to prefer generic/whole foods over branded/processed ones.
   * Items without brandName are sorted first; branded items are pushed to the end.
   */
  private preferGenericFoods(results: FoodSearchResult[], searchTerm?: string): FoodSearchResult[] {
    const generic: FoodSearchResult[] = [];
    const branded: FoodSearchResult[] = [];

    for (const r of results) {
      if (r.brandName) {
        branded.push(r);
      } else {
        generic.push(r);
      }
    }

    // Within generics, prefer results matching the cooking state of the search term.
    // Only boost results that also match at least one non-cooking-state word from the
    // search term (prevents e.g. "Banana, Raw" being promoted over "Broccoli, Steamed"
    // when searching "broccoli raw").
    const cookingState = searchTerm ? extractCookingState(searchTerm) : null;
    if (cookingState) {
      const baseWords = searchTerm!
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !COOKING_STATE_KEYWORDS.includes(w));

      generic.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aMatchesBase = baseWords.length === 0 || baseWords.some((w) => aLower.includes(w));
        const bMatchesBase = baseWords.length === 0 || baseWords.some((w) => bLower.includes(w));

        // Only apply cooking-state preference among results that match the base food
        if (aMatchesBase && bMatchesBase) {
          const aHas = aLower.includes(cookingState!) ? 0 : 1;
          const bHas = bLower.includes(cookingState!) ? 0 : 1;
          return aHas - bHas;
        }
        // Base-matching results always rank above non-matching ones
        if (aMatchesBase !== bMatchesBase) {
          return aMatchesBase ? -1 : 1;
        }
        return 0;
      });
    }

    return [...generic, ...branded];
  }

  /**
   * Scale nutrition from a serving to match target kcal.
   * Returns null if scaling would be too extreme (>MAX_SCALE_FACTOR),
   * signaling the caller to fall back to AI estimates.
   */
  private scaleNutrition(
    serving: FoodServing,
    targetKcal: number,
    servingScale: number
  ): { nutrition: ScaledNutrition; scaleFactor: number } | null {
    const baseKcal = serving.calories * servingScale;
    if (baseKcal <= 0) return null;

    const scaleFactor = targetKcal / baseKcal;

    // If scaling is too extreme, the FatSecret match is likely a single
    // ingredient rather than a full meal — fall back to AI estimates
    if (scaleFactor > MAX_SCALE_FACTOR || scaleFactor < MIN_SCALE_FACTOR) {
      return null;
    }

    const sProtein = Math.round(serving.protein * servingScale * scaleFactor * 10) / 10;
    const sCarbs = Math.round(serving.carbohydrate * servingScale * scaleFactor * 10) / 10;
    const sFat = Math.round(serving.fat * servingScale * scaleFactor * 10) / 10;
    const scaled = {
      nutrition: {
        kcal: kcalFromMacros(sProtein, sCarbs, sFat),
        proteinG: sProtein,
        carbsG: sCarbs,
        fatG: sFat,
        fiberG:
          serving.fiber !== undefined
            ? Math.round(serving.fiber * servingScale * scaleFactor * 10) / 10
            : undefined,
      },
      scaleFactor,
    };

    engineLogger.warn(
      `[NutritionCompiler] Scale: base=${baseKcal} target=${targetKcal} factor=${scaleFactor.toFixed(2)} → ${scaled.nutrition.kcal} kcal (serving: "${serving.servingDescription}")`
    );

    return scaled;
  }

  /**
   * Try to verify a meal's nutrition using a food database (FatSecret or USDA).
   * Searches for the meal, picks the best serving, and scales to target kcal.
   * Returns null if no usable match is found.
   */
  private async tryVerifyFromFoodDB(
    searchFn: (query: string, max: number) => Promise<{ foodId: string }[]>,
    getFoodFn: (id: string) => Promise<FoodDetails>,
    meal: DraftMeal,
    source: string,
    clientIntake?: ClientIntake
  ): Promise<{
    nutrition: ScaledNutrition;
    ingredients: Ingredient[];
    foodId: string;
    scaleFactor: number;
  } | null> {
    const results = await searchFn(meal.foodSearchQuery, 5);
    if (results.length === 0) return null;

    // Try each search result until one produces a reasonable scale factor
    for (const match of results) {
      const foodDetails = await getFoodFn(match.foodId);
      if (foodDetails.servings.length === 0) continue;

      // Dietary compliance filter: skip products that violate allergies or dietary style
      if (clientIntake) {
        const allergies = clientIntake.allergies;
        const dietaryStyle = clientIntake.dietaryStyle;
        if (!isProductCompliant(foodDetails.name, allergies, dietaryStyle)) {
          engineLogger.warn(
            `[NutritionCompiler] ${source} skipping "${foodDetails.name}" — violates dietary compliance ` +
              `(allergies: [${allergies.join(', ')}], diet: ${dietaryStyle})`
          );
          continue;
        }
      }

      const targetKcal = meal.targetNutrition.kcal;
      const servingScale = meal.suggestedServings || 1;
      const bestServing = this.selectBestServing(foodDetails.servings, targetKcal);

      const scaled = this.scaleNutrition(bestServing, targetKcal, servingScale);
      if (scaled) {
        const ingredients = buildIngredientsFromFood(foodDetails, meal, scaled.scaleFactor);
        engineLogger.info(
          `[NutritionCompiler] ${source} verified "${meal.name}" via "${foodDetails.name}" ` +
            `(${bestServing.servingDescription}, ${bestServing.calories} kcal/serving, ` +
            `scale: ${scaled.scaleFactor.toFixed(2)}x → ${scaled.nutrition.kcal} kcal)`
        );
        return {
          nutrition: scaled.nutrition,
          ingredients,
          foodId: match.foodId,
          scaleFactor: scaled.scaleFactor,
        };
      }
    }

    // All matches required extreme scaling — not usable
    engineLogger.warn(
      `[NutritionCompiler] ${source} matches for "${meal.foodSearchQuery}" all require ` +
        `extreme scaling (>${MAX_SCALE_FACTOR}x), falling back to AI estimates`
    );
    return null;
  }

  /**
   * Try looking up a single ingredient from one food database source.
   * Shared validation: scale range, calorie cap, kcal/g density,
   * cooking-state mismatch, macro density, dietary compliance.
   */
  private async tryIngredientFromSource(
    searchFn: (query: string, max: number) => Promise<{ foodId: string }[]>,
    getFoodFn: (id: string) => Promise<FoodDetails>,
    searchName: string,
    ingName: string,
    gramsNeeded: number,
    dailyTargetKcal: number | undefined,
    clientIntake: ClientIntake | undefined,
    sourceName: string,
    foodIdPrefix: string,
    reorderResults?: (results: { foodId: string }[]) => { foodId: string }[]
  ): Promise<{
    ingredient: Ingredient;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | undefined;
    verified: boolean;
  } | null> {
    const results = await searchFn(searchName, 5);
    if (results.length === 0) return null;

    const orderedResults = reorderResults ? reorderResults(results) : results;

    for (const result of orderedResults) {
      const foodDetails = await getFoodFn(result.foodId);
      if (foodDetails.servings.length === 0) continue;

      if (clientIntake) {
        if (
          !isProductCompliant(foodDetails.name, clientIntake.allergies, clientIntake.dietaryStyle)
        ) {
          engineLogger.warn(
            `[NutritionCompiler] Skipping ${sourceName} "${foodDetails.name}" for ingredient "${ingName}" — dietary compliance`
          );
          continue;
        }
      }

      const bestServing = this.selectBestServingForGrams(
        foodDetails.servings,
        gramsNeeded,
        foodDetails.name
      );
      if (!bestServing) continue;

      const scale = gramsNeeded / bestServing.servingGrams;
      if (scale < 0.01 || scale > 20) {
        engineLogger.warn(
          `[NutritionCompiler] Rejecting ${sourceName} "${foodDetails.name}" for "${ingName}": scale ${scale.toFixed(2)}x out of range`
        );
        continue;
      }

      const ingredientKcal = bestServing.serving.calories * scale;
      if (dailyTargetKcal && dailyTargetKcal < 1500) {
        const maxIngredientKcal = dailyTargetKcal * 0.4;
        if (ingredientKcal > maxIngredientKcal) {
          engineLogger.warn(
            `[NutritionCompiler] Rejecting ${sourceName} "${foodDetails.name}" for "${ingName}": ` +
              `${Math.round(ingredientKcal)} kcal exceeds ${Math.round(maxIngredientKcal)} kcal cap`
          );
          continue;
        }
      }

      const kcalPerGram = ingredientKcal / gramsNeeded;
      const kcalPerGramLimit = bestServing.wasMLConverted ? 10.0 : 9.5;
      if (kcalPerGram > kcalPerGramLimit) {
        engineLogger.warn(
          `[NutritionCompiler] Anomalous data: ${sourceName} "${foodDetails.name}" ` +
            `${kcalPerGram.toFixed(1)} kcal/g exceeds limit. Skipping.`
        );
        continue;
      }

      const searchCookingState = extractCookingState(searchName);
      if (searchCookingState === 'cooked' && kcalPerGram > COOKED_KCAL_PER_GRAM_CEILING) {
        engineLogger.warn(
          `[NutritionCompiler] Cooking-state mismatch: ${sourceName} "${foodDetails.name}" ` +
            `${kcalPerGram.toFixed(1)} kcal/g exceeds cooked ceiling. Skipping.`
        );
        continue;
      }

      const scaledFat = bestServing.serving.fat * scale;
      const scaledProtein = bestServing.serving.protein * scale;
      const fatPerGram = scaledFat / gramsNeeded;
      const proteinPerGram = scaledProtein / gramsNeeded;
      const macroDensityLimit = bestServing.wasMLConverted ? 1.15 : 1.05;
      if (fatPerGram > macroDensityLimit || proteinPerGram > macroDensityLimit) {
        engineLogger.warn(
          `[NutritionCompiler] Anomalous macros for ${sourceName} "${foodDetails.name}" ` +
            `(fat/g=${fatPerGram.toFixed(2)}, protein/g=${proteinPerGram.toFixed(2)}). Skipping.`
        );
        continue;
      }

      return {
        ingredient: {
          name: ingName,
          amount: Math.round(gramsNeeded),
          unit: 'g',
          foodId: `${foodIdPrefix}-${result.foodId}`,
        } as Ingredient,
        kcal: ingredientKcal,
        proteinG: bestServing.serving.protein * scale,
        carbsG: bestServing.serving.carbohydrate * scale,
        fatG: bestServing.serving.fat * scale,
        fiberG:
          bestServing.serving.fiber !== undefined ? bestServing.serving.fiber * scale : undefined,
        verified: true,
      };
    }

    return null;
  }

  /**
   * Compile a meal using per-ingredient food database lookups.
   * Each ingredient is looked up individually in FatSecret (then USDA fallback),
   * and nutrition is summed for accurate meal totals.
   */
  private async compileMealFromIngredients(
    meal: DraftMeal,
    dailyTargetKcal: number | undefined,
    clientIntake: ClientIntake | undefined
  ): Promise<{
    nutrition: ScaledNutrition;
    ingredients: Ingredient[];
    confidenceLevel: 'verified' | 'ai_estimated';
  }> {
    const ingredientLimit = pLimit(INGREDIENT_CONCURRENCY_LIMIT);
    let verifiedCount = 0;
    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let hasFiber = false;
    const compiledIngredients: Ingredient[] = [];

    const results = await Promise.all(
      meal.draftIngredients.map((ing) =>
        ingredientLimit(async () => {
          const gramsNeeded = convertToGrams(ing.quantity, ing.unit);
          const normalized = normalizeIngredientName(ing.name, this.aliasCache);

          // Try each normalized name variant against all sources
          for (const { searchName, fdcId } of normalized) {
            // --- Direct fdcId lookup (O(1), skip search entirely) ---
            if (fdcId && this.localUsdaAdapter) {
              try {
                const foodDetails = await this.localUsdaAdapter.getFood(String(fdcId));
                const bestServing = this.selectBestServingForGrams(
                  foodDetails.servings,
                  gramsNeeded,
                  foodDetails.name
                );
                if (bestServing) {
                  const scale = gramsNeeded / bestServing.servingGrams;
                  if (scale >= 0.01 && scale <= 20) {
                    const ingredientKcal = bestServing.serving.calories * scale;
                    engineLogger.info(
                      `[NutritionCompiler] Direct fdcId hit for "${ing.name}" → ${foodDetails.name} (fdcId=${fdcId})`
                    );
                    return {
                      ingredient: {
                        name: ing.name,
                        amount: Math.round(gramsNeeded),
                        unit: 'g',
                        foodId: `usda-${fdcId}`,
                      } as Ingredient,
                      kcal: ingredientKcal,
                      proteinG: bestServing.serving.protein * scale,
                      carbsG: bestServing.serving.carbohydrate * scale,
                      fatG: bestServing.serving.fat * scale,
                      fiberG:
                        bestServing.serving.fiber !== undefined
                          ? bestServing.serving.fiber * scale
                          : undefined,
                      verified: true,
                    };
                  }
                }
              } catch (err) {
                engineLogger.warn(
                  `[NutritionCompiler] Direct fdcId lookup failed for "${ing.name}" (fdcId=${fdcId}):`,
                  err instanceof Error ? err.message : err
                );
              }
            }

            // --- Local USDA primary (sub-millisecond, no API calls) ---
            if (this.localUsdaAdapter) {
              try {
                const localRef = this.localUsdaAdapter;
                const localResult = await this.tryIngredientFromSource(
                  (q, max) => localRef.searchFoods(q, max),
                  (id) => localRef.getFood(id),
                  searchName,
                  ing.name,
                  gramsNeeded,
                  dailyTargetKcal,
                  clientIntake,
                  'LocalUSDA',
                  'usda'
                );
                if (localResult) return localResult;
              } catch (err) {
                engineLogger.warn(
                  `[NutritionCompiler] LocalUSDA lookup failed for ingredient "${searchName}":`,
                  err instanceof Error ? err.message : err
                );
              }
            }

            // --- USDA live API fallback ---
            try {
              const usdaResult = await this.tryIngredientFromSource(
                (q, max) => this.usdaAdapter.searchFoods(q, max),
                (id) => this.usdaAdapter.getFood(id),
                searchName,
                ing.name,
                gramsNeeded,
                dailyTargetKcal,
                clientIntake,
                'USDA',
                'usda'
              );
              if (usdaResult) return usdaResult;
            } catch (err) {
              engineLogger.warn(
                `[NutritionCompiler] USDA lookup failed for ingredient "${searchName}":`,
                err instanceof Error ? err.message : err
              );
            }

            // --- FatSecret fallback ---
            if (this.fatSecretAdapter) {
              try {
                const fsRef = this.fatSecretAdapter;
                const fsResult = await this.tryIngredientFromSource(
                  (q, max) => fsRef.searchFoods(q, max),
                  (id) => fsRef.getFood(id),
                  searchName,
                  ing.name,
                  gramsNeeded,
                  dailyTargetKcal,
                  clientIntake,
                  'FatSecret',
                  'fatsecret',
                  (results) => this.preferGenericFoods(results as FoodSearchResult[], searchName)
                );
                if (fsResult) return fsResult;
              } catch (err) {
                engineLogger.warn(
                  `[NutritionCompiler] FatSecret fallback failed for ingredient "${searchName}":`,
                  err instanceof Error ? err.message : err
                );
              }
            }
          }

          // All names/sources failed — ingredient stays unverified
          engineLogger.warn(
            `[NutritionCompiler] No match found for ingredient "${ing.name}" (tried: ${normalized.map((n) => n.searchName).join(', ')})`
          );
          return {
            ingredient: {
              name: ing.name,
              amount: Math.round(gramsNeeded),
              unit: 'g',
            } as Ingredient,
            kcal: 0,
            proteinG: 0,
            carbsG: 0,
            fatG: 0,
            fiberG: undefined as number | undefined,
            verified: false,
          };
        })
      )
    );

    // Sum all ingredient nutrition
    for (const r of results) {
      compiledIngredients.push(r.ingredient);
      totalKcal += r.kcal;
      totalProtein += r.proteinG;
      totalCarbs += r.carbsG;
      totalFat += r.fatG;
      if (r.fiberG !== undefined) {
        totalFiber += r.fiberG;
        hasFiber = true;
      }
      if (r.verified) verifiedCount++;
    }

    // Per-meal total cap: if total exceeds 2x the meal target, fall back to AI estimates
    const mealTargetKcal = meal.targetNutrition.kcal;
    if (mealTargetKcal && mealTargetKcal > 0 && totalKcal > mealTargetKcal * 2.0) {
      engineLogger.warn(
        `[NutritionCompiler] Meal "${meal.name}" total ${Math.round(totalKcal)} kcal ` +
          `exceeds 2x target ${mealTargetKcal}. Falling back to AI estimates.`
      );
      return {
        nutrition: {
          kcal: kcalFromMacros(
            meal.estimatedNutrition.proteinG,
            meal.estimatedNutrition.carbsG,
            meal.estimatedNutrition.fatG
          ),
          proteinG: meal.estimatedNutrition.proteinG,
          carbsG: meal.estimatedNutrition.carbsG,
          fatG: meal.estimatedNutrition.fatG,
          fiberG: undefined,
        },
        ingredients: compiledIngredients,
        confidenceLevel: 'ai_estimated',
      };
    }

    const totalIngredients = meal.draftIngredients.length;
    const verifiedRatio = totalIngredients > 0 ? verifiedCount / totalIngredients : 0;
    const confidenceLevel = verifiedRatio >= 0.7 ? 'verified' : 'ai_estimated';

    // Derive calories from macros (4/4/9) to guarantee consistency
    const roundedProtein = Math.round(totalProtein * 10) / 10;
    const roundedCarbs = Math.round(totalCarbs * 10) / 10;
    const roundedFat = Math.round(totalFat * 10) / 10;
    const macroKcal = kcalFromMacros(roundedProtein, roundedCarbs, roundedFat);
    const sourceKcal = Math.round(totalKcal);
    if (Math.abs(macroKcal - sourceKcal) > sourceKcal * 0.05) {
      engineLogger.info(
        `[NutritionCompiler] Calorie reconciliation for "${meal.name}": ` +
          `source=${sourceKcal} kcal, macro-derived=${macroKcal} kcal (delta=${macroKcal - sourceKcal})`
      );
    }

    engineLogger.info(
      `[NutritionCompiler] Ingredient-level: "${meal.name}" — ${verifiedCount}/${totalIngredients} verified (${Math.round(verifiedRatio * 100)}%) → ${confidenceLevel}, ${macroKcal} kcal`
    );

    return {
      nutrition: {
        kcal: macroKcal,
        proteinG: roundedProtein,
        carbsG: roundedCarbs,
        fatG: roundedFat,
        fiberG: hasFiber ? Math.round(totalFiber * 10) / 10 : undefined,
      },
      ingredients: compiledIngredients,
      confidenceLevel,
    };
  }

  /**
   * Compile a single meal. 3-strategy approach:
   *   Strategy 1 (PRIMARY): Ingredient-level lookups (if draftIngredients available)
   *   Strategy 2 (FALLBACK): Single-food FatSecret/USDA lookup (for old drafts)
   *   Strategy 3 (FINAL): AI estimates from draft
   */
  private async compileMeal(
    meal: DraftMeal,
    dailyTargetKcal?: number,
    clientIntake?: ClientIntake
  ): Promise<CompiledMeal> {
    let confidenceLevel: 'verified' | 'ai_estimated' = 'ai_estimated';
    let nutrition = {
      kcal: kcalFromMacros(
        meal.estimatedNutrition.proteinG,
        meal.estimatedNutrition.carbsG,
        meal.estimatedNutrition.fatG
      ),
      proteinG: meal.estimatedNutrition.proteinG,
      carbsG: meal.estimatedNutrition.carbsG,
      fatG: meal.estimatedNutrition.fatG,
      fiberG: undefined as number | undefined,
    };
    let ingredients: Ingredient[] = [];

    try {
      // Strategy 1: Ingredient-level lookups (new primary path)
      if (meal.draftIngredients && meal.draftIngredients.length > 0) {
        const result = await this.compileMealFromIngredients(meal, dailyTargetKcal, clientIntake);

        // Post-compilation recalibration: scale ingredient quantities so
        // verified nutrition hits per-meal calorie target
        const recalibrated = this.recalibrateMealToTarget(result, meal.targetNutrition);

        if (recalibrated.applied) {
          engineLogger.info(
            `[NutritionCompiler] Recalibration: "${meal.name}" ${recalibrated.reason}`
          );
        }

        nutrition = recalibrated.nutrition;
        ingredients = recalibrated.ingredients;
        confidenceLevel = result.confidenceLevel;
      } else {
        // Strategy 2: Single-food lookup (fallback for old drafts without ingredients)
        let verified = false;

        // --- Local USDA primary (sub-millisecond) ---
        if (this.localUsdaAdapter) {
          const localRef = this.localUsdaAdapter;
          const localResult = await this.tryVerifyFromFoodDB(
            (q, max) => localRef.searchFoods(q, max),
            (id) => localRef.getFood(id),
            meal,
            'LocalUSDA',
            clientIntake
          );

          if (localResult) {
            nutrition = localResult.nutrition;
            ingredients = localResult.ingredients;
            confidenceLevel = 'verified';
            verified = true;
          }
        }

        // --- USDA live API fallback ---
        if (!verified) {
          const usdaResult = await this.tryVerifyFromFoodDB(
            (q, max) => this.usdaAdapter.searchFoods(q, max),
            (id) => this.usdaAdapter.getFood(id),
            meal,
            'USDA',
            clientIntake
          );

          if (usdaResult) {
            nutrition = usdaResult.nutrition;
            ingredients = usdaResult.ingredients;
            confidenceLevel = 'verified';
            verified = true;
          }
        }

        // --- FatSecret fallback for Strategy 2 ---
        if (!verified && this.fatSecretAdapter) {
          try {
            const fatsecretRef = this.fatSecretAdapter;
            const fatsecretResult = await this.tryVerifyFromFoodDB(
              (q, max) => fatsecretRef.searchFoods(q, max),
              (id) => fatsecretRef.getFood(id),
              meal,
              'FatSecret',
              clientIntake
            );

            if (fatsecretResult) {
              nutrition = fatsecretResult.nutrition;
              ingredients = fatsecretResult.ingredients;
              confidenceLevel = 'verified';
            }
          } catch (fatsecretError) {
            engineLogger.warn(
              `[NutritionCompiler] FatSecret fallback failed for "${meal.foodSearchQuery}":`,
              fatsecretError instanceof Error ? fatsecretError.message : fatsecretError
            );
          }
        }
      }
    } catch (error) {
      // Strategy 3: AI estimates (already set as defaults)
      engineLogger.warn(
        `[NutritionCompiler] All strategies failed for "${meal.name}":`,
        error instanceof Error ? error.message : error
      );
    }

    // If no ingredients from API, generate from meal name/tags
    if (ingredients.length === 0) {
      ingredients = generateEstimatedIngredients(meal);
    }

    // Generate cooking instructions
    const instructions = generateInstructions(meal, ingredients);

    return {
      slot: meal.slot,
      name: meal.name,
      cuisine: meal.cuisine,
      prepTimeMin: meal.prepTimeMin,
      cookTimeMin: meal.cookTimeMin,
      servings: meal.suggestedServings || 1,
      nutrition,
      recipeId: undefined,
      confidenceLevel,
      ingredients,
      instructions,
      primaryProtein: meal.primaryProtein,
      tags: meal.tags,
    };
  }

  /**
   * Recalibrate compiled meal nutrition toward the per-meal calorie target.
   *
   * After compileMealFromIngredients() sums real nutrition from food databases,
   * the total often diverges from the target because Claude's ingredient
   * quantity estimates don't match real calorie densities. This scales all
   * ingredient amounts by a uniform factor to close the calorie gap.
   *
   * Skips if: within 15% threshold, factor outside [0.5, 2.0], or zero kcal.
   */
  private recalibrateMealToTarget(
    result: {
      nutrition: ScaledNutrition;
      ingredients: Ingredient[];
      confidenceLevel: 'verified' | 'ai_estimated';
    },
    targetNutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number }
  ): {
    nutrition: ScaledNutrition;
    ingredients: Ingredient[];
    applied: boolean;
    reason: string;
  } {
    const actualKcal = result.nutrition.kcal;
    const targetKcal = targetNutrition.kcal;

    if (targetKcal <= 0 || actualKcal <= 0) {
      return {
        nutrition: result.nutrition,
        ingredients: result.ingredients,
        applied: false,
        reason: 'skipped: zero kcal',
      };
    }

    const variance = (actualKcal - targetKcal) / targetKcal;

    if (Math.abs(variance) <= RECALIBRATION_THRESHOLD) {
      return {
        nutrition: result.nutrition,
        ingredients: result.ingredients,
        applied: false,
        reason: `skipped: within threshold (${(variance * 100).toFixed(1)}%)`,
      };
    }

    const factor = targetKcal / actualKcal;

    if (factor < MIN_RECALIBRATION_FACTOR || factor > MAX_RECALIBRATION_FACTOR) {
      engineLogger.warn(
        `[NutritionCompiler] Recalibration guard: factor ${factor.toFixed(2)}x outside [${MIN_RECALIBRATION_FACTOR}-${MAX_RECALIBRATION_FACTOR}] — likely food mismatch`
      );
      return {
        nutrition: result.nutrition,
        ingredients: result.ingredients,
        applied: false,
        reason: `skipped: factor ${factor.toFixed(2)}x outside guard range`,
      };
    }

    const scaledIngredients = result.ingredients.map((ing) => ({
      ...ing,
      amount: Math.round(ing.amount * factor * 100) / 100,
    }));

    const scaledProtein = Math.round(result.nutrition.proteinG * factor * 10) / 10;
    const scaledCarbs = Math.round(result.nutrition.carbsG * factor * 10) / 10;
    const scaledFat = Math.round(result.nutrition.fatG * factor * 10) / 10;
    const scaledNutrition: ScaledNutrition = {
      kcal: kcalFromMacros(scaledProtein, scaledCarbs, scaledFat),
      proteinG: scaledProtein,
      carbsG: scaledCarbs,
      fatG: scaledFat,
      fiberG:
        result.nutrition.fiberG !== undefined
          ? Math.round(result.nutrition.fiberG * factor * 10) / 10
          : undefined,
    };

    return {
      nutrition: scaledNutrition,
      ingredients: scaledIngredients,
      applied: true,
      reason: `recalibrated: ${actualKcal} -> ${scaledNutrition.kcal} kcal (${factor.toFixed(2)}x)`,
    };
  }

  /**
   * Post-compilation day-level calibration.
   * Proportionally adjusts all meals in a day so the daily total kcal
   * moves closer to the target. Each meal is clamped to +/-20% adjustment
   * to avoid distorting individual meals too much.
   */
  private calibrateDay(day: CompiledDay): CompiledDay {
    const targetKcal = day.targetKcal;
    if (targetKcal <= 0) return day;

    const variance = (day.dailyTotals.kcal - targetKcal) / targetKcal;
    if (Math.abs(variance) <= 0.03) return day; // Already within QA tolerance

    const kcalGap = targetKcal - day.dailyTotals.kcal;

    const adjustedMeals = day.meals.map((meal) => {
      if (day.dailyTotals.kcal === 0) return meal;
      const mealShare = meal.nutrition.kcal / day.dailyTotals.kcal;
      const mealAdjustment = kcalGap * mealShare;
      const mealFactor =
        meal.nutrition.kcal > 0 ? (meal.nutrition.kcal + mealAdjustment) / meal.nutrition.kcal : 1;

      // Clamp to +/-20% per meal
      const clampedFactor = Math.max(0.8, Math.min(1.2, mealFactor));

      const dayScaledProtein = Math.round(meal.nutrition.proteinG * clampedFactor * 10) / 10;
      const dayScaledCarbs = Math.round(meal.nutrition.carbsG * clampedFactor * 10) / 10;
      const dayScaledFat = Math.round(meal.nutrition.fatG * clampedFactor * 10) / 10;

      return {
        ...meal,
        nutrition: {
          kcal: kcalFromMacros(dayScaledProtein, dayScaledCarbs, dayScaledFat),
          proteinG: dayScaledProtein,
          carbsG: dayScaledCarbs,
          fatG: dayScaledFat,
          fiberG: meal.nutrition.fiberG
            ? Math.round(meal.nutrition.fiberG * clampedFactor * 10) / 10
            : undefined,
        },
        ingredients: meal.ingredients.map((ing) => ({
          ...ing,
          amount: Math.round(ing.amount * clampedFactor * 100) / 100,
        })),
      };
    });

    // Recalculate daily totals
    let newProtein = 0,
      newCarbs = 0,
      newFat = 0,
      newFiber = 0;
    for (const m of adjustedMeals) {
      newProtein += m.nutrition.proteinG;
      newCarbs += m.nutrition.carbsG;
      newFat += m.nutrition.fatG;
      if (m.nutrition.fiberG) newFiber += m.nutrition.fiberG;
    }

    const roundedNewProtein = Math.round(newProtein * 10) / 10;
    const roundedNewCarbs = Math.round(newCarbs * 10) / 10;
    const roundedNewFat = Math.round(newFat * 10) / 10;
    const newTotals = {
      kcal: kcalFromMacros(roundedNewProtein, roundedNewCarbs, roundedNewFat),
      proteinG: roundedNewProtein,
      carbsG: roundedNewCarbs,
      fatG: roundedNewFat,
      fiberG: newFiber > 0 ? Math.round(newFiber * 10) / 10 : undefined,
    };
    const newVarianceKcal = newTotals.kcal - targetKcal;
    const newVariancePercent =
      targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

    return {
      ...day,
      meals: adjustedMeals,
      dailyTotals: newTotals,
      varianceKcal: Math.round(newVarianceKcal),
      variancePercent: newVariancePercent,
    };
  }

  /**
   * Calculate daily nutrition totals from compiled meals.
   */
  private calculateDailyTotals(meals: CompiledMeal[]) {
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    let fiberG = 0;

    for (const meal of meals) {
      proteinG += meal.nutrition.proteinG;
      carbsG += meal.nutrition.carbsG;
      fatG += meal.nutrition.fatG;
      if (meal.nutrition.fiberG) {
        fiberG += meal.nutrition.fiberG;
      }
    }

    const roundedP = Math.round(proteinG * 10) / 10;
    const roundedC = Math.round(carbsG * 10) / 10;
    const roundedF = Math.round(fatG * 10) / 10;
    return {
      kcal: kcalFromMacros(roundedP, roundedC, roundedF),
      proteinG: roundedP,
      carbsG: roundedC,
      fatG: roundedF,
      fiberG: fiberG > 0 ? Math.round(fiberG * 10) / 10 : undefined,
    };
  }

  /**
   * Calculate weekly averages across all compiled days.
   */
  private calculateWeeklyAverages(days: CompiledDay[]) {
    if (days.length === 0) {
      return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const day of days) {
      totalKcal += day.dailyTotals.kcal;
      totalProtein += day.dailyTotals.proteinG;
      totalCarbs += day.dailyTotals.carbsG;
      totalFat += day.dailyTotals.fatG;
    }

    const count = days.length;
    return {
      kcal: Math.round(totalKcal / count),
      proteinG: Math.round((totalProtein / count) * 10) / 10,
      carbsG: Math.round((totalCarbs / count) * 10) / 10,
      fatG: Math.round((totalFat / count) * 10) / 10,
    };
  }
}
