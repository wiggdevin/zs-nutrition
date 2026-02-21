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
import { engineLogger } from '../../utils/logger';
import {
  buildIngredientsFromFood,
  generateEstimatedIngredients,
  generateInstructions,
} from './ingredient-builder';
import type { FoodServing, FoodDetails, FoodSearchResult } from '../../adapters/fatsecret';

/** Nutrition data after scaling to target kcal */
interface ScaledNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | undefined;
}

/** Maximum concurrent FatSecret API calls to respect rate limits */
const FATSECRET_CONCURRENCY_LIMIT = 5;

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

/** Concurrency limit for ingredient-level lookups (higher than meal-level) */
const INGREDIENT_CONCURRENCY_LIMIT = 8;

/** Recalibration: only activate if actual kcal diverges from target by more than this fraction */
const RECALIBRATION_THRESHOLD = 0.15;

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

/**
 * Map of common generic ingredient names to more specific FatSecret search terms.
 * Fixes the ~30 most common unmatched ingredients from validation runs.
 */
const INGREDIENT_NAME_MAP: Record<string, string> = {
  // Proteins
  eggs: 'egg whole raw',
  egg: 'egg whole raw',
  'egg whites': 'egg white raw',
  chicken: 'chicken breast raw',
  'chicken breast': 'chicken breast skinless raw',
  salmon: 'atlantic salmon raw',
  tuna: 'tuna canned in water drained',
  shrimp: 'shrimp raw',
  'ground beef': 'ground beef 90 lean raw',
  'ground turkey': 'ground turkey raw',
  tofu: 'tofu firm raw',
  tempeh: 'tempeh',
  // Grains & starches
  rice: 'white rice cooked',
  'brown rice': 'brown rice cooked',
  'sweet potato': 'sweet potato baked',
  'sweet potatoes': 'sweet potato baked',
  potato: 'potato baked flesh and skin',
  potatoes: 'potato baked flesh and skin',
  oats: 'oats rolled dry',
  oatmeal: 'oats rolled dry',
  quinoa: 'quinoa cooked',
  pasta: 'pasta cooked',
  bread: 'whole wheat bread',
  // Vegetables
  broccoli: 'broccoli raw',
  spinach: 'spinach raw',
  kale: 'kale raw',
  'mixed greens': 'mixed salad greens raw',
  tomato: 'tomato raw',
  tomatoes: 'tomato raw',
  onion: 'onion raw',
  // Fruits
  banana: 'banana raw',
  apple: 'apple raw with skin',
  berries: 'mixed berries raw',
  blueberries: 'blueberries raw',
  strawberries: 'strawberries raw',
  avocado: 'avocado raw',
  // Dairy & fats
  'greek yogurt': 'greek yogurt plain nonfat',
  yogurt: 'yogurt plain low fat',
  cheese: 'cheddar cheese',
  butter: 'butter salted',
  'olive oil': 'olive oil',
  'coconut oil': 'coconut oil',
  milk: 'milk whole',
  // Nuts & seeds
  almonds: 'almonds raw',
  walnuts: 'walnuts raw',
  'peanut butter': 'peanut butter smooth',
  'almond butter': 'almond butter',
  // Legumes
  'black beans': 'black beans cooked',
  chickpeas: 'chickpeas cooked',
  lentils: 'lentils cooked',
};

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
 * Normalize an ingredient name to improve FatSecret search hit rate.
 * Returns an array (usually 1 item; multiple for compound names like "Apple + Peanut Butter").
 */
function normalizeIngredientName(name: string): string[] {
  const trimmed = name.trim().toLowerCase();

  // Check exact match in map
  if (INGREDIENT_NAME_MAP[trimmed]) {
    return [INGREDIENT_NAME_MAP[trimmed]];
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
    return parts.flatMap((part) => normalizeIngredientName(part));
  }

  // Check map again after cleaning
  if (INGREDIENT_NAME_MAP[cleaned]) {
    return [INGREDIENT_NAME_MAP[cleaned]];
  }

  return [cleaned];
}

/**
 * Agent 4: Nutrition Compiler
 * Verifies nutrition via FatSecret API, gets full recipes, scales portions.
 * Tags meals as "verified" or "ai_estimated" based on FatSecret match.
 *
 * Performance optimization: Uses p-limit to parallelize FatSecret API calls
 * with a concurrency limit to respect rate limits.
 */
export class NutritionCompiler {
  private readonly limit = pLimit(FATSECRET_CONCURRENCY_LIMIT);

  constructor(
    private fatSecretAdapter: FatSecretAdapter,
    private usdaAdapter?: USDAAdapter
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
        const compiled = await this.compileDay(day);
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
  private async compileDay(day: DraftDay): Promise<CompiledDay> {
    // Process all meals in this day concurrently, limited by p-limit
    const compiledMeals = await Promise.all(
      day.meals.map((meal) => this.limit(() => this.compileMeal(meal, day.targetKcal)))
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

    return {
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
  ): { serving: FoodServing; servingGrams: number } | null {
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

    // Combined candidate pool
    const candidates: { serving: FoodServing; servingGrams: number }[] = [
      ...withGrams.map((s) => ({ serving: s, servingGrams: s.metricServingAmount! })),
      ...mlConverted,
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
      return { serving: best.serving, servingGrams: best.servingGrams };
    }

    // No gram metadata — try to find a "per 100g" by description
    const per100gByDesc = servings.find(
      (s) =>
        s.servingDescription.toLowerCase().includes('100g') ||
        s.servingDescription.toLowerCase().includes('100 g')
    );
    if (per100gByDesc) {
      return { serving: per100gByDesc, servingGrams: 100 };
    }

    // No usable gram data at all
    return null;
  }

  /**
   * Reorder search results to prefer generic/whole foods over branded/processed ones.
   * Items without brandName are sorted first; branded items are pushed to the end.
   */
  private preferGenericFoods(results: FoodSearchResult[]): FoodSearchResult[] {
    const generic: FoodSearchResult[] = [];
    const branded: FoodSearchResult[] = [];

    for (const r of results) {
      if (r.brandName) {
        branded.push(r);
      } else {
        generic.push(r);
      }
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

    const scaled = {
      nutrition: {
        kcal: Math.round(serving.calories * servingScale * scaleFactor),
        proteinG: Math.round(serving.protein * servingScale * scaleFactor * 10) / 10,
        carbsG: Math.round(serving.carbohydrate * servingScale * scaleFactor * 10) / 10,
        fatG: Math.round(serving.fat * servingScale * scaleFactor * 10) / 10,
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
    source: string
  ): Promise<{
    nutrition: ScaledNutrition;
    ingredients: Ingredient[];
    foodId: string;
    scaleFactor: number;
  } | null> {
    const results = await searchFn(meal.fatsecretSearchQuery, 5);
    if (results.length === 0) return null;

    // Try each search result until one produces a reasonable scale factor
    for (const match of results) {
      const foodDetails = await getFoodFn(match.foodId);
      if (foodDetails.servings.length === 0) continue;

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
      `[NutritionCompiler] ${source} matches for "${meal.fatsecretSearchQuery}" all require ` +
        `extreme scaling (>${MAX_SCALE_FACTOR}x), falling back to AI estimates`
    );
    return null;
  }

  /**
   * Compile a meal using per-ingredient food database lookups.
   * Each ingredient is looked up individually in FatSecret (then USDA fallback),
   * and nutrition is summed for accurate meal totals.
   */
  private async compileMealFromIngredients(
    meal: DraftMeal,
    dailyTargetKcal?: number
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
          const normalizedNames = normalizeIngredientName(ing.name);

          // Try each normalized name variant
          for (const searchName of normalizedNames) {
            // --- FatSecret ---
            try {
              const searchResults = await this.fatSecretAdapter.searchFoods(searchName, 5);
              if (searchResults.length > 0) {
                const orderedResults = this.preferGenericFoods(searchResults);

                // Try multiple search results, not just the first
                for (const result of orderedResults) {
                  const foodDetails = await this.fatSecretAdapter.getFood(result.foodId);
                  if (foodDetails.servings.length === 0) continue;

                  const bestServing = this.selectBestServingForGrams(
                    foodDetails.servings,
                    gramsNeeded,
                    foodDetails.name
                  );
                  if (!bestServing) continue;

                  const scale = gramsNeeded / bestServing.servingGrams;

                  // Sanity check: reject absurd scale factors
                  if (scale < 0.01 || scale > 20) {
                    engineLogger.warn(
                      `[NutritionCompiler] Rejecting "${foodDetails.name}" for "${ing.name}": scale ${scale.toFixed(2)}x out of range`
                    );
                    continue;
                  }

                  // Per-ingredient calorie cap for low-calorie plans
                  const ingredientKcal = bestServing.serving.calories * scale;
                  if (dailyTargetKcal && dailyTargetKcal < 1500) {
                    const maxIngredientKcal = dailyTargetKcal * 0.4;
                    if (ingredientKcal > maxIngredientKcal) {
                      engineLogger.warn(
                        `[NutritionCompiler] Rejecting "${foodDetails.name}" for "${ing.name}": ` +
                          `${Math.round(ingredientKcal)} kcal exceeds ${Math.round(maxIngredientKcal)} kcal cap ` +
                          `(40% of ${dailyTargetKcal} daily target)`
                      );
                      continue;
                    }
                  }

                  return {
                    ingredient: {
                      name: ing.name,
                      amount: Math.round(gramsNeeded),
                      unit: 'g',
                      fatsecretFoodId: result.foodId,
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
                `[NutritionCompiler] FatSecret lookup failed for ingredient "${searchName}":`,
                err instanceof Error ? err.message : err
              );
            }

            // --- USDA fallback ---
            if (this.usdaAdapter) {
              try {
                const usdaResults = await this.usdaAdapter.searchFoods(searchName, 5);
                if (usdaResults.length > 0) {
                  for (const result of usdaResults) {
                    const foodDetails = await this.usdaAdapter.getFood(result.foodId);
                    if (foodDetails.servings.length === 0) continue;

                    const bestServing = this.selectBestServingForGrams(
                      foodDetails.servings,
                      gramsNeeded,
                      foodDetails.name
                    );
                    if (!bestServing) continue;

                    const scale = gramsNeeded / bestServing.servingGrams;

                    if (scale < 0.01 || scale > 20) {
                      engineLogger.warn(
                        `[NutritionCompiler] Rejecting USDA "${foodDetails.name}" for "${ing.name}": scale ${scale.toFixed(2)}x out of range`
                      );
                      continue;
                    }

                    // Per-ingredient calorie cap for low-calorie plans
                    const ingredientKcal = bestServing.serving.calories * scale;
                    if (dailyTargetKcal && dailyTargetKcal < 1500) {
                      const maxIngredientKcal = dailyTargetKcal * 0.4;
                      if (ingredientKcal > maxIngredientKcal) {
                        engineLogger.warn(
                          `[NutritionCompiler] Rejecting USDA "${foodDetails.name}" for "${ing.name}": ` +
                            `${Math.round(ingredientKcal)} kcal exceeds ${Math.round(maxIngredientKcal)} kcal cap ` +
                            `(40% of ${dailyTargetKcal} daily target)`
                        );
                        continue;
                      }
                    }

                    return {
                      ingredient: {
                        name: ing.name,
                        amount: Math.round(gramsNeeded),
                        unit: 'g',
                        fatsecretFoodId: `usda-${result.foodId}`,
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
                  `[NutritionCompiler] USDA lookup failed for ingredient "${searchName}":`,
                  err instanceof Error ? err.message : err
                );
              }
            }
          }

          // All names/sources failed — ingredient stays unverified
          engineLogger.warn(
            `[NutritionCompiler] No match found for ingredient "${ing.name}" (tried: ${normalizedNames.join(', ')})`
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

    const totalIngredients = meal.draftIngredients.length;
    const verifiedRatio = totalIngredients > 0 ? verifiedCount / totalIngredients : 0;
    const confidenceLevel = verifiedRatio >= 0.7 ? 'verified' : 'ai_estimated';

    engineLogger.info(
      `[NutritionCompiler] Ingredient-level: "${meal.name}" — ${verifiedCount}/${totalIngredients} verified (${Math.round(verifiedRatio * 100)}%) → ${confidenceLevel}, ${Math.round(totalKcal)} kcal`
    );

    return {
      nutrition: {
        kcal: Math.round(totalKcal),
        proteinG: Math.round(totalProtein * 10) / 10,
        carbsG: Math.round(totalCarbs * 10) / 10,
        fatG: Math.round(totalFat * 10) / 10,
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
  private async compileMeal(meal: DraftMeal, dailyTargetKcal?: number): Promise<CompiledMeal> {
    let confidenceLevel: 'verified' | 'ai_estimated' = 'ai_estimated';
    let nutrition = {
      kcal: meal.estimatedNutrition.kcal,
      proteinG: meal.estimatedNutrition.proteinG,
      carbsG: meal.estimatedNutrition.carbsG,
      fatG: meal.estimatedNutrition.fatG,
      fiberG: undefined as number | undefined,
    };
    let ingredients: Ingredient[] = [];

    try {
      // Strategy 1: Ingredient-level lookups (new primary path)
      if (meal.draftIngredients && meal.draftIngredients.length > 0) {
        const result = await this.compileMealFromIngredients(meal, dailyTargetKcal);

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
        // Strategy 2: Single-food FatSecret lookup (fallback for old drafts)
        let verified = false;

        const fatsecretResult = await this.tryVerifyFromFoodDB(
          (q, max) => this.fatSecretAdapter.searchFoods(q, max),
          (id) => this.fatSecretAdapter.getFood(id),
          meal,
          'FatSecret'
        );

        if (fatsecretResult) {
          nutrition = fatsecretResult.nutrition;
          ingredients = fatsecretResult.ingredients;
          confidenceLevel = 'verified';
          verified = true;
        }

        // USDA fallback for Strategy 2
        if (!verified && this.usdaAdapter) {
          try {
            const usdaRef = this.usdaAdapter;
            const usdaResult = await this.tryVerifyFromFoodDB(
              (q, max) => usdaRef.searchFoods(q, max),
              (id) => usdaRef.getFood(id),
              meal,
              'USDA'
            );

            if (usdaResult) {
              nutrition = usdaResult.nutrition;
              ingredients = usdaResult.ingredients;
              confidenceLevel = 'verified';
            }
          } catch (usdaError) {
            engineLogger.warn(
              `[NutritionCompiler] USDA fallback failed for "${meal.fatsecretSearchQuery}":`,
              usdaError instanceof Error ? usdaError.message : usdaError
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
      fatsecretRecipeId: undefined,
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

    const scaledNutrition: ScaledNutrition = {
      kcal: Math.round(actualKcal * factor),
      proteinG: Math.round(result.nutrition.proteinG * factor * 10) / 10,
      carbsG: Math.round(result.nutrition.carbsG * factor * 10) / 10,
      fatG: Math.round(result.nutrition.fatG * factor * 10) / 10,
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
   * Calculate daily nutrition totals from compiled meals.
   */
  private calculateDailyTotals(meals: CompiledMeal[]) {
    let kcal = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    let fiberG = 0;

    for (const meal of meals) {
      kcal += meal.nutrition.kcal;
      proteinG += meal.nutrition.proteinG;
      carbsG += meal.nutrition.carbsG;
      fatG += meal.nutrition.fatG;
      if (meal.nutrition.fiberG) {
        fiberG += meal.nutrition.fiberG;
      }
    }

    return {
      kcal: Math.round(kcal),
      proteinG: Math.round(proteinG * 10) / 10,
      carbsG: Math.round(carbsG * 10) / 10,
      fatG: Math.round(fatG * 10) / 10,
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
