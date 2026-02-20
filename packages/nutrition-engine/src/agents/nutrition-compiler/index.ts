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
import type { FoodServing, FoodDetails } from '../../adapters/fatsecret';

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
      day.meals.map((meal) => this.limit(() => this.compileMeal(meal)))
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
  private async compileMealFromIngredients(meal: DraftMeal): Promise<{
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

          // Try FatSecret first
          try {
            const searchResults = await this.fatSecretAdapter.searchFoods(ing.name, 5);
            if (searchResults.length > 0) {
              const foodDetails = await this.fatSecretAdapter.getFood(searchResults[0].foodId);
              if (foodDetails.servings.length > 0) {
                // Find per-100g serving or best available
                const per100g = foodDetails.servings.find(
                  (s) => s.metricServingAmount === 100 && s.metricServingUnit === 'g'
                );
                const serving = per100g || foodDetails.servings[0];
                const servingGrams = serving.metricServingAmount || 100;
                const scale = gramsNeeded / servingGrams;

                return {
                  ingredient: {
                    name: ing.name,
                    amount: Math.round(gramsNeeded),
                    unit: 'g',
                    fatsecretFoodId: searchResults[0].foodId,
                  } as Ingredient,
                  kcal: serving.calories * scale,
                  proteinG: serving.protein * scale,
                  carbsG: serving.carbohydrate * scale,
                  fatG: serving.fat * scale,
                  fiberG: serving.fiber !== undefined ? serving.fiber * scale : undefined,
                  verified: true,
                };
              }
            }
          } catch (err) {
            engineLogger.warn(
              `[NutritionCompiler] FatSecret lookup failed for ingredient "${ing.name}":`,
              err instanceof Error ? err.message : err
            );
          }

          // Try USDA fallback
          if (this.usdaAdapter) {
            try {
              const usdaResults = await this.usdaAdapter.searchFoods(ing.name, 5);
              if (usdaResults.length > 0) {
                const foodDetails = await this.usdaAdapter.getFood(usdaResults[0].foodId);
                if (foodDetails.servings.length > 0) {
                  const per100g = foodDetails.servings.find(
                    (s) => s.metricServingAmount === 100 && s.metricServingUnit === 'g'
                  );
                  const serving = per100g || foodDetails.servings[0];
                  const servingGrams = serving.metricServingAmount || 100;
                  const scale = gramsNeeded / servingGrams;

                  return {
                    ingredient: {
                      name: ing.name,
                      amount: Math.round(gramsNeeded),
                      unit: 'g',
                      fatsecretFoodId: `usda-${usdaResults[0].foodId}`,
                    } as Ingredient,
                    kcal: serving.calories * scale,
                    proteinG: serving.protein * scale,
                    carbsG: serving.carbohydrate * scale,
                    fatG: serving.fat * scale,
                    fiberG: serving.fiber !== undefined ? serving.fiber * scale : undefined,
                    verified: true,
                  };
                }
              }
            } catch (err) {
              engineLogger.warn(
                `[NutritionCompiler] USDA lookup failed for ingredient "${ing.name}":`,
                err instanceof Error ? err.message : err
              );
            }
          }

          // Both failed — ingredient stays unverified
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
  private async compileMeal(meal: DraftMeal): Promise<CompiledMeal> {
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
        const result = await this.compileMealFromIngredients(meal);
        nutrition = result.nutrition;
        ingredients = result.ingredients;
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
