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

  async compile(draft: MealPlanDraft): Promise<MealPlanCompiled> {
    const startTime = Date.now();
    engineLogger.info('[NutritionCompiler] Starting compilation with parallel processing');

    // Process all days in parallel (each day's meals are processed concurrently with rate limiting)
    const compiledDays = await Promise.all(draft.days.map((day) => this.compileDay(day)));

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

    return {
      dayNumber: day.dayNumber,
      dayName: day.dayName,
      isTrainingDay: day.isTrainingDay,
      targetKcal: day.targetKcal,
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
   * Compile a single meal by searching FatSecret for verification.
   * Strategy:
   *   1. Search FatSecret recipes (full meals with realistic nutrition)
   *   2. Search FatSecret foods, pick best serving, scale to target
   *   3. USDA fallback with same logic
   *   4. Fall back to AI estimates if nothing works
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
    let fatsecretRecipeId: string | undefined;

    try {
      // Strategy 1: Try FatSecret recipe search (returns full meals)
      let verified = false;
      try {
        const recipeResults = await this.fatSecretAdapter.searchRecipes(
          meal.fatsecretSearchQuery,
          3
        );
        if (recipeResults.length > 0) {
          const recipe = await this.fatSecretAdapter.getRecipe(recipeResults[0].recipeId);
          engineLogger.warn(
            `[NutritionCompiler] Recipe found for "${meal.name}": "${recipe.name}" ` +
              `(calories=${recipe.nutrition.calories}, protein=${recipe.nutrition.protein})`
          );
          if (recipe.nutrition.calories > 0) {
            const targetKcal = meal.targetNutrition.kcal;
            const baseKcal = recipe.nutrition.calories;
            const scaleFactor = targetKcal / baseKcal;

            if (scaleFactor >= MIN_SCALE_FACTOR && scaleFactor <= MAX_SCALE_FACTOR) {
              nutrition = {
                kcal: Math.round(baseKcal * scaleFactor),
                proteinG: Math.round(recipe.nutrition.protein * scaleFactor * 10) / 10,
                carbsG: Math.round(recipe.nutrition.carbohydrate * scaleFactor * 10) / 10,
                fatG: Math.round(recipe.nutrition.fat * scaleFactor * 10) / 10,
                fiberG:
                  recipe.nutrition.fiber !== undefined
                    ? Math.round(recipe.nutrition.fiber * scaleFactor * 10) / 10
                    : undefined,
              };
              confidenceLevel = 'verified';
              fatsecretRecipeId = recipeResults[0].recipeId;
              verified = true;

              engineLogger.warn(
                `[NutritionCompiler] Recipe SCALED: target=${targetKcal} base=${baseKcal} factor=${scaleFactor.toFixed(2)} → ${nutrition.kcal} kcal`
              );

              // Build ingredients from recipe
              if (recipe.ingredients.length > 0) {
                ingredients = recipe.ingredients.map((ing) => ({
                  name: ing.name,
                  amount: parseFloat(ing.amount) || 1,
                  unit: ing.amount.replace(/[\d.]+\s*/, '').trim() || 'serving',
                  fatsecretFoodId: ing.foodId,
                }));
              }
            }
          }
        }
      } catch (recipeError) {
        // Recipe search failed, continue to food search
        engineLogger.warn(
          `[NutritionCompiler] Recipe search failed for "${meal.fatsecretSearchQuery}":`,
          recipeError instanceof Error ? recipeError.message : recipeError
        );
      }

      // Strategy 2: Try FatSecret food search with best-serving selection
      if (!verified) {
        const result = await this.tryVerifyFromFoodDB(
          (q, max) => this.fatSecretAdapter.searchFoods(q, max),
          (id) => this.fatSecretAdapter.getFood(id),
          meal,
          'FatSecret'
        );

        if (result) {
          nutrition = result.nutrition;
          ingredients = result.ingredients;
          fatsecretRecipeId = result.foodId;
          confidenceLevel = 'verified';
          verified = true;
        }
      }

      // Strategy 3: USDA fallback
      if (!verified && this.usdaAdapter) {
        try {
          const usdaRef = this.usdaAdapter;
          const result = await this.tryVerifyFromFoodDB(
            (q, max) => usdaRef.searchFoods(q, max),
            (id) => usdaRef.getFood(id),
            meal,
            'USDA'
          );

          if (result) {
            nutrition = result.nutrition;
            ingredients = result.ingredients;
            fatsecretRecipeId = `usda-${result.foodId}`;
            confidenceLevel = 'verified';
          }
        } catch (usdaError) {
          engineLogger.warn(
            `[NutritionCompiler] USDA fallback failed for "${meal.fatsecretSearchQuery}":`,
            usdaError instanceof Error ? usdaError.message : usdaError
          );
        }
      }
    } catch (error) {
      // FatSecret search failed -- fall back to AI estimates
      engineLogger.warn(
        `[NutritionCompiler] FatSecret search failed for "${meal.fatsecretSearchQuery}":`,
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
      fatsecretRecipeId,
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
