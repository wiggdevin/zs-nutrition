/**
 * FatSecret food and recipe detail retrieval methods
 */

import { OAuthManager, apiRequest } from './oauth';
import { FatSecretCache } from './cache';
import { fatSecretCircuitBreaker } from './circuit-breaker';
import { LocalFoodDatabase } from './local-fallback';
import type { FoodDetails, RecipeDetails, FatSecretFoodResponse, FatSecretServing } from './types';

/** Raw ingredient entry from the FatSecret recipe.get.v2 API response */
interface FatSecretRecipeIngredient {
  food_id?: string | number;
  food_name?: string;
  ingredient_description?: string;
  number_of_units?: string | number;
  measurement_description?: string;
}

/** Raw direction entry from the FatSecret recipe.get.v2 API response */
interface FatSecretRecipeDirection {
  direction_number?: string | number;
  direction_description?: string;
}

/** Raw serving size entry from the FatSecret recipe.get.v2 API response */
interface FatSecretRecipeServing {
  calories?: string | number;
  protein?: string | number;
  carbohydrate?: string | number;
  fat?: string | number;
  fiber?: string | number;
}

/** Recipe detail response from FatSecret API */
interface FatSecretRecipeResponse {
  recipe?: {
    recipe_id?: string | number;
    recipe_name?: string;
    recipe_description?: string;
    preparation_time_min?: string | number;
    cooking_time_min?: string | number;
    number_of_servings?: string | number;
    ingredients?: { ingredient?: FatSecretRecipeIngredient | FatSecretRecipeIngredient[] };
    directions?: { direction?: FatSecretRecipeDirection | FatSecretRecipeDirection[] };
    serving_sizes?: { serving?: FatSecretRecipeServing };
  };
}

/** Barcode lookup response from FatSecret API */
interface FatSecretBarcodeResponse {
  food_id?: { value?: string };
}

export async function getFood(
  oauth: OAuthManager,
  cache: FatSecretCache,
  isConfigured: boolean,
  foodId: string
): Promise<FoodDetails> {
  if (!isConfigured) {
    return LocalFoodDatabase.getFood(foodId);
  }

  // Check cache first (L1 + L2)
  const cached = await cache.getFoodResult(foodId);
  if (cached) {
    return cached;
  }

  const data = (await fatSecretCircuitBreaker.execute(() =>
    apiRequest(oauth, 'food.get.v4', {
      food_id: foodId,
    })
  )) as FatSecretFoodResponse;
  const food = data?.food;
  if (!food) {
    throw new Error(`Food ${foodId} not found`);
  }

  const servingsData = food.servings?.serving;
  const servingsArray = Array.isArray(servingsData)
    ? servingsData
    : servingsData
      ? [servingsData]
      : [];

  const result: FoodDetails = {
    foodId: String(food.food_id),
    name: food.food_name,
    brandName: food.brand_name || undefined,
    servings: servingsArray.map((s: FatSecretServing) => ({
      servingId: String(s.serving_id),
      servingDescription: s.serving_description || s.measurement_description || '1 serving',
      metricServingAmount: s.metric_serving_amount ? Number(s.metric_serving_amount) : undefined,
      metricServingUnit: s.metric_serving_unit || undefined,
      calories: Number(s.calories) || 0,
      protein: Number(s.protein) || 0,
      carbohydrate: Number(s.carbohydrate) || 0,
      fat: Number(s.fat) || 0,
      fiber: s.fiber ? Number(s.fiber) : undefined,
    })),
  };

  // Store in cache (L1 + L2)
  await cache.setFoodResult(foodId, result);
  return result;
}

export async function getFoodByBarcode(
  oauth: OAuthManager,
  isConfigured: boolean,
  foodId_getFood: (foodId: string) => Promise<FoodDetails>,
  barcode: string
): Promise<FoodDetails | null> {
  if (!isConfigured) {
    return null;
  }

  try {
    const data = (await fatSecretCircuitBreaker.execute(() =>
      apiRequest(oauth, 'food.find_id_for_barcode', { barcode })
    )) as FatSecretBarcodeResponse;
    const foodId = data?.food_id?.value;
    if (!foodId) {
      return null;
    }
    return foodId_getFood(foodId);
  } catch {
    return null;
  }
}

export async function getRecipe(
  oauth: OAuthManager,
  cache: FatSecretCache,
  isConfigured: boolean,
  recipeId: string
): Promise<RecipeDetails> {
  if (!isConfigured) {
    throw new Error('Recipe lookup requires FatSecret API credentials');
  }

  // Check cache first
  const cached = cache.getRecipe(recipeId);
  if (cached) {
    return cached;
  }

  const data = (await fatSecretCircuitBreaker.execute(() =>
    apiRequest(oauth, 'recipe.get.v2', { recipe_id: recipeId })
  )) as FatSecretRecipeResponse;
  const r = data?.recipe;
  if (!r) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  const ingredientData = r.ingredients?.ingredient;
  const ingredientsArray = Array.isArray(ingredientData)
    ? ingredientData
    : ingredientData
      ? [ingredientData]
      : [];

  const directionData = r.directions?.direction;
  const directionsArray = Array.isArray(directionData)
    ? directionData
    : directionData
      ? [directionData]
      : [];

  const result: RecipeDetails = {
    recipeId: String(r.recipe_id),
    name: r.recipe_name ?? '',
    description: r.recipe_description || '',
    preparationTimeMin: r.preparation_time_min ? Number(r.preparation_time_min) : undefined,
    cookingTimeMin: r.cooking_time_min ? Number(r.cooking_time_min) : undefined,
    servingSize: Number(r.number_of_servings) || 1,
    ingredients: ingredientsArray.map((i: FatSecretRecipeIngredient) => ({
      foodId: i.food_id ? String(i.food_id) : undefined,
      name: i.ingredient_description || i.food_name || '',
      amount: i.number_of_units
        ? `${i.number_of_units} ${i.measurement_description || ''}`.trim()
        : '',
    })),
    directions: directionsArray.map((d: FatSecretRecipeDirection) => ({
      stepNumber: Number(d.direction_number) || 0,
      description: d.direction_description || '',
    })),
    nutrition: {
      calories: Number(r.serving_sizes?.serving?.calories) || 0,
      protein: Number(r.serving_sizes?.serving?.protein) || 0,
      carbohydrate: Number(r.serving_sizes?.serving?.carbohydrate) || 0,
      fat: Number(r.serving_sizes?.serving?.fat) || 0,
      fiber: r.serving_sizes?.serving?.fiber ? Number(r.serving_sizes.serving.fiber) : undefined,
    },
  };

  // Store in cache
  cache.setRecipe(recipeId, result);
  return result;
}
