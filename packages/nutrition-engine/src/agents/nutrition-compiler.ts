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
  VerifiedNutritionSchema,
} from '../types/schemas';
import { FatSecretAdapter, FoodSearchResult, FoodDetails } from '../adapters/fatsecret';
import { engineLogger } from '../utils/logger';

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

  constructor(private fatSecretAdapter: FatSecretAdapter) {}

  async compile(draft: MealPlanDraft): Promise<MealPlanCompiled> {
    const startTime = Date.now();
    engineLogger.info('[NutritionCompiler] Starting compilation with parallel processing');

    // Process all days in parallel (each day's meals are processed concurrently with rate limiting)
    const compiledDays = await Promise.all(
      draft.days.map(day => this.compileDay(day))
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
      day.meals.map(meal => this.limit(() => this.compileMeal(meal)))
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
        // Found a match — get detailed food info
        const bestMatch = searchResults[0];
        const foodDetails = await this.fatSecretAdapter.getFood(bestMatch.foodId);

        if (foodDetails.servings.length > 0) {
          // Use the first serving's nutrition data, scaled to suggested servings
          const serving = foodDetails.servings[0];
          const servingScale = meal.suggestedServings || 1;

          // Scale nutrition to match TARGET kcal (not estimated)
          // This ensures the meal meets the nutritional target for that slot
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
          ingredients = this.buildIngredientsFromFood(foodDetails, meal, scaleFactor);
        }
      }
    } catch (error) {
      // FatSecret search failed — fall back to AI estimates
      engineLogger.warn(
        `[NutritionCompiler] FatSecret search failed for "${meal.fatsecretSearchQuery}":`,
        error instanceof Error ? error.message : error
      );
    }

    // If no ingredients from FatSecret, generate from meal name/tags
    if (ingredients.length === 0) {
      ingredients = this.generateEstimatedIngredients(meal);
    }

    // Generate cooking instructions
    const instructions = this.generateInstructions(meal, ingredients);

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
   * Build ingredient list from FatSecret food details.
   */
  private buildIngredientsFromFood(
    foodDetails: FoodDetails,
    meal: DraftMeal,
    scaleFactor: number
  ): Ingredient[] {
    const ingredients: Ingredient[] = [];

    // Primary ingredient from FatSecret
    const primaryServing = foodDetails.servings[0];
    if (primaryServing) {
      ingredients.push({
        name: foodDetails.name,
        amount: Math.round((primaryServing.metricServingAmount || 100) * scaleFactor),
        unit: primaryServing.metricServingUnit || 'g',
        fatsecretFoodId: foodDetails.foodId,
      });
    }

    // Add complementary ingredients based on meal tags/search query
    const complementary = this.getComplementaryIngredients(meal);
    ingredients.push(...complementary);

    return ingredients;
  }

  /**
   * Generate estimated ingredients when FatSecret data is unavailable.
   */
  private generateEstimatedIngredients(meal: DraftMeal): Ingredient[] {
    const ingredients: Ingredient[] = [];

    // Parse the search query for ingredient hints
    const queryWords = meal.fatsecretSearchQuery.toLowerCase().split(/\s+/);

    // Common protein sources
    const proteinMap: Record<string, { name: string; amount: number; unit: string }> = {
      chicken: { name: 'Chicken Breast', amount: 170, unit: 'g' },
      salmon: { name: 'Salmon Fillet', amount: 170, unit: 'g' },
      beef: { name: 'Lean Ground Beef', amount: 150, unit: 'g' },
      turkey: { name: 'Turkey Breast', amount: 150, unit: 'g' },
      eggs: { name: 'Eggs', amount: 3, unit: 'large' },
      egg: { name: 'Eggs', amount: 2, unit: 'large' },
      tuna: { name: 'Tuna, Canned in Water', amount: 142, unit: 'g' },
      shrimp: { name: 'Shrimp', amount: 150, unit: 'g' },
      tofu: { name: 'Firm Tofu', amount: 200, unit: 'g' },
      cod: { name: 'Cod Fillet', amount: 170, unit: 'g' },
      pork: { name: 'Pork Tenderloin', amount: 150, unit: 'g' },
      yogurt: { name: 'Greek Yogurt, Plain', amount: 200, unit: 'g' },
      chickpeas: { name: 'Chickpeas, Cooked', amount: 150, unit: 'g' },
      lentils: { name: 'Lentils, Cooked', amount: 150, unit: 'g' },
      beans: { name: 'Black Beans, Cooked', amount: 150, unit: 'g' },
    };

    // Add protein source
    let addedProtein = false;
    for (const word of queryWords) {
      if (proteinMap[word]) {
        ingredients.push(proteinMap[word]);
        addedProtein = true;
        break;
      }
    }

    if (!addedProtein && meal.primaryProtein && proteinMap[meal.primaryProtein]) {
      ingredients.push(proteinMap[meal.primaryProtein]);
    }

    // Common carb sources
    const carbMap: Record<string, { name: string; amount: number; unit: string }> = {
      rice: { name: 'Brown Rice, Cooked', amount: 150, unit: 'g' },
      quinoa: { name: 'Quinoa, Cooked', amount: 150, unit: 'g' },
      pasta: { name: 'Whole Wheat Pasta, Cooked', amount: 140, unit: 'g' },
      bread: { name: 'Whole Wheat Bread', amount: 2, unit: 'slices' },
      toast: { name: 'Whole Grain Toast', amount: 2, unit: 'slices' },
      oats: { name: 'Rolled Oats', amount: 50, unit: 'g' },
      potato: { name: 'Sweet Potato', amount: 150, unit: 'g' },
      tortillas: { name: 'Corn Tortillas', amount: 3, unit: 'pieces' },
      wrap: { name: 'Whole Wheat Tortilla', amount: 1, unit: 'large' },
      bagel: { name: 'Whole Grain Bagel', amount: 1, unit: 'piece' },
      pancakes: { name: 'Whole Grain Pancake Mix', amount: 80, unit: 'g' },
    };

    for (const word of queryWords) {
      if (carbMap[word]) {
        ingredients.push(carbMap[word]);
        break;
      }
    }

    // Common vegetables/additions
    const vegMap: Record<string, { name: string; amount: number; unit: string }> = {
      spinach: { name: 'Fresh Spinach', amount: 60, unit: 'g' },
      broccoli: { name: 'Broccoli Florets', amount: 100, unit: 'g' },
      avocado: { name: 'Avocado', amount: 0.5, unit: 'medium' },
      tomatoes: { name: 'Cherry Tomatoes', amount: 80, unit: 'g' },
      peppers: { name: 'Bell Peppers', amount: 100, unit: 'g' },
      vegetables: { name: 'Mixed Vegetables', amount: 150, unit: 'g' },
      berries: { name: 'Mixed Berries', amount: 100, unit: 'g' },
      banana: { name: 'Banana', amount: 1, unit: 'medium' },
      mango: { name: 'Mango, Diced', amount: 100, unit: 'g' },
      lettuce: { name: 'Romaine Lettuce', amount: 60, unit: 'g' },
      salad: { name: 'Mixed Greens', amount: 80, unit: 'g' },
      corn: { name: 'Corn Kernels', amount: 80, unit: 'g' },
      zucchini: { name: 'Zucchini', amount: 150, unit: 'g' },
      mushrooms: { name: 'Mushrooms, Sliced', amount: 80, unit: 'g' },
    };

    for (const word of queryWords) {
      if (vegMap[word]) {
        ingredients.push(vegMap[word]);
      }
    }

    // If still no ingredients, add generic ones
    if (ingredients.length === 0) {
      ingredients.push(
        { name: 'Primary Ingredient', amount: 150, unit: 'g' },
        { name: 'Secondary Ingredient', amount: 100, unit: 'g' }
      );
    }

    // Add cooking oil for cooked meals
    if (meal.cookTimeMin > 0 && !meal.tags.includes('no-cook')) {
      ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
    }

    // Add seasoning
    ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });

    return ingredients;
  }

  /**
   * Get complementary ingredients based on the meal's characteristics.
   */
  private getComplementaryIngredients(meal: DraftMeal): Ingredient[] {
    const ingredients: Ingredient[] = [];
    const query = meal.fatsecretSearchQuery.toLowerCase();

    // Add carb source if mentioned in query
    if (query.includes('rice')) {
      ingredients.push({ name: 'Brown Rice, Cooked', amount: 150, unit: 'g' });
    } else if (query.includes('quinoa')) {
      ingredients.push({ name: 'Quinoa, Cooked', amount: 150, unit: 'g' });
    } else if (query.includes('toast') || query.includes('bread')) {
      ingredients.push({ name: 'Whole Grain Bread', amount: 2, unit: 'slices' });
    } else if (query.includes('pasta') || query.includes('noodles')) {
      ingredients.push({ name: 'Whole Wheat Pasta', amount: 140, unit: 'g' });
    }

    // Add vegetable if mentioned
    if (query.includes('spinach')) {
      ingredients.push({ name: 'Fresh Spinach', amount: 60, unit: 'g' });
    } else if (query.includes('broccoli')) {
      ingredients.push({ name: 'Broccoli Florets', amount: 100, unit: 'g' });
    } else if (query.includes('asparagus')) {
      ingredients.push({ name: 'Asparagus Spears', amount: 100, unit: 'g' });
    } else if (query.includes('vegetables')) {
      ingredients.push({ name: 'Mixed Vegetables', amount: 150, unit: 'g' });
    }

    // Add seasoning
    if (meal.cookTimeMin > 0) {
      ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
    }
    ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });

    return ingredients;
  }

  /**
   * Generate cooking instructions based on meal characteristics.
   */
  private generateInstructions(meal: DraftMeal, ingredients: Ingredient[]): string[] {
    const instructions: string[] = [];

    // Prep step
    const ingredientNames = ingredients
      .filter((i) => i.name !== 'Salt and Pepper' && i.name !== 'Olive Oil')
      .map((i) => i.name.toLowerCase())
      .slice(0, 3);

    instructions.push(
      `Prepare all ingredients: wash, measure, and portion ${ingredientNames.join(', ')}.`
    );

    if (meal.tags.includes('no-cook')) {
      instructions.push(`Combine ingredients in a bowl or container.`);
      instructions.push(
        `Mix well and serve${meal.tags.includes('meal-prep') ? ' or refrigerate for later' : ''}.`
      );
    } else {
      // Cooking method based on tags
      if (meal.tags.includes('grill')) {
        instructions.push(`Preheat grill to medium-high heat.`);
        instructions.push(
          `Season ${meal.primaryProtein || 'protein'} with salt, pepper, and desired spices.`
        );
        instructions.push(
          `Grill for ${Math.round(meal.cookTimeMin / 2)} minutes per side until cooked through.`
        );
      } else if (meal.tags.includes('stir-fry')) {
        instructions.push(`Heat olive oil in a large skillet or wok over high heat.`);
        instructions.push(
          `Add ${meal.primaryProtein || 'protein'} and stir-fry for 3-4 minutes until browned.`
        );
        instructions.push(
          `Add vegetables and cook for another ${Math.round(meal.cookTimeMin / 3)} minutes.`
        );
      } else if (meal.tags.includes('bake')) {
        instructions.push(`Preheat oven to 375°F (190°C).`);
        instructions.push(
          `Season ${meal.primaryProtein || 'protein'} and place on a lined baking sheet.`
        );
        instructions.push(
          `Bake for ${meal.cookTimeMin} minutes until internal temperature reaches safe levels.`
        );
      } else {
        instructions.push(`Heat a pan over medium heat with olive oil.`);
        instructions.push(
          `Cook ${meal.primaryProtein || 'main ingredient'} for ${meal.cookTimeMin} minutes until done.`
        );
      }

      instructions.push(`Plate and serve with sides. Season to taste.`);
    }

    return instructions;
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
