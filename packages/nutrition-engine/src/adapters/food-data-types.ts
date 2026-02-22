/**
 * Shared food data types used by both FatSecret and USDA adapters.
 * Canonical definitions for the nutrition pipeline's food data interfaces.
 */

/** Optional L2 (Redis) cache interface for food API adapters. */
export interface ExternalFoodCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface FoodSearchResult {
  foodId: string;
  name: string;
  description: string;
  brandName?: string;
}

export interface FoodDetails {
  foodId: string;
  name: string;
  brandName?: string;
  servings: FoodServing[];
}

export interface FoodServing {
  servingId: string;
  servingDescription: string;
  metricServingAmount?: number;
  metricServingUnit?: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fiber?: number;
}

export interface RecipeSearchResult {
  recipeId: string;
  name: string;
  description: string;
  preparationTimeMin?: number;
  cookingTimeMin?: number;
}

export interface RecipeDetails {
  recipeId: string;
  name: string;
  description: string;
  preparationTimeMin?: number;
  cookingTimeMin?: number;
  servingSize: number;
  ingredients: RecipeIngredient[];
  directions: RecipeDirection[];
  nutrition: {
    calories: number;
    protein: number;
    carbohydrate: number;
    fat: number;
    fiber?: number;
  };
}

export interface RecipeIngredient {
  foodId?: string;
  name: string;
  amount: string;
}

export interface RecipeDirection {
  stepNumber: number;
  description: string;
}
