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

/** Maximum concurrent FatSecret API calls to respect rate limits */
const FATSECRET_CONCURRENCY_LIMIT = 5;

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
   * Compile a single meal by searching FatSecret for verification.
   * If found: use FatSecret nutrition data, tag as "verified".
   * If not found: use AI estimates, tag as "ai_estimated".
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
      // Search FatSecret for the meal
      const searchResults = await this.fatSecretAdapter.searchFoods(meal.fatsecretSearchQuery, 5);

      if (searchResults.length > 0) {
        // Found a match -- get detailed food info
        const bestMatch = searchResults[0];
        const foodDetails = await this.fatSecretAdapter.getFood(bestMatch.foodId);

        if (foodDetails.servings.length > 0) {
          // Use the first serving's nutrition data, scaled to suggested servings
          const serving = foodDetails.servings[0];
          const servingScale = meal.suggestedServings || 1;

          // Scale nutrition to match TARGET kcal (not estimated)
          const baseKcal = serving.calories * servingScale;
          const targetKcal = meal.targetNutrition.kcal;
          const scaleFactor =
            baseKcal > 0 ? Math.min(Math.max(targetKcal / baseKcal, 0.5), 3.0) : 1;

          nutrition = {
            kcal: Math.round(serving.calories * servingScale * scaleFactor),
            proteinG: Math.round(serving.protein * servingScale * scaleFactor * 10) / 10,
            carbsG: Math.round(serving.carbohydrate * servingScale * scaleFactor * 10) / 10,
            fatG: Math.round(serving.fat * servingScale * scaleFactor * 10) / 10,
            fiberG:
              serving.fiber !== undefined
                ? Math.round(serving.fiber * servingScale * scaleFactor * 10) / 10
                : undefined,
          };

          confidenceLevel = 'verified';
          fatsecretRecipeId = bestMatch.foodId;

          // Build ingredient list from food details
          ingredients = buildIngredientsFromFood(foodDetails, meal, scaleFactor);
        }
      }

      // USDA fallback: when FatSecret returns no results, try USDA FoodData Central
      if (searchResults.length === 0 && this.usdaAdapter) {
        try {
          const usdaResults = await this.usdaAdapter.searchFoods(meal.fatsecretSearchQuery, 5);

          if (usdaResults.length > 0) {
            const bestMatch = usdaResults[0];
            const foodDetails = await this.usdaAdapter.getFood(bestMatch.foodId);

            if (foodDetails.servings.length > 0) {
              const serving = foodDetails.servings[0];
              const servingScale = meal.suggestedServings || 1;

              const baseKcal = serving.calories * servingScale;
              const targetKcal = meal.targetNutrition.kcal;
              const scaleFactor =
                baseKcal > 0 ? Math.min(Math.max(targetKcal / baseKcal, 0.5), 3.0) : 1;

              nutrition = {
                kcal: Math.round(serving.calories * servingScale * scaleFactor),
                proteinG: Math.round(serving.protein * servingScale * scaleFactor * 10) / 10,
                carbsG: Math.round(serving.carbohydrate * servingScale * scaleFactor * 10) / 10,
                fatG: Math.round(serving.fat * servingScale * scaleFactor * 10) / 10,
                fiberG:
                  serving.fiber !== undefined
                    ? Math.round(serving.fiber * servingScale * scaleFactor * 10) / 10
                    : undefined,
              };

              confidenceLevel = 'verified';
              fatsecretRecipeId = `usda-${bestMatch.foodId}`;

              ingredients = buildIngredientsFromFood(foodDetails, meal, scaleFactor);
            }
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

    // If no ingredients from FatSecret, generate from meal name/tags
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
