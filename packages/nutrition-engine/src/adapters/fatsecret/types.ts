/**
 * FatSecret adapter types
 * Internal API response types and public exported interfaces.
 */

// ============================================================================
// FatSecret API Response Types (internal)
// These types model the raw API responses to reduce `any` usage
// ============================================================================

/** Individual food item from FatSecret search results */
export interface FatSecretFoodItem {
  food_id: string;
  food_name: string;
  food_type: string;
  food_description?: string;
  brand_name?: string;
  food_url?: string;
}

/** Serving information from FatSecret food details */
export interface FatSecretServing {
  serving_id: string;
  serving_description?: string;
  measurement_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
}

/** Food details response from FatSecret API */
export interface FatSecretFoodResponse {
  food?: {
    food_id: string;
    food_name: string;
    food_type: string;
    brand_name?: string;
    food_url?: string;
    servings?: {
      serving: FatSecretServing | FatSecretServing[];
    };
  };
}

/** Foods search response from FatSecret API */
export interface FatSecretSearchResponse {
  foods?: {
    food?: FatSecretFoodItem | FatSecretFoodItem[];
    max_results?: string;
    page_number?: string;
    total_results?: string;
  };
}

/** Recipe item from FatSecret recipe search */
export interface FatSecretRecipeItem {
  recipe_id: string;
  recipe_name: string;
  recipe_description?: string;
  preparation_time_min?: string;
  cooking_time_min?: string;
}

/** Recipes search response from FatSecret API */
export interface FatSecretRecipeSearchResponse {
  recipes?: {
    recipe?: FatSecretRecipeItem | FatSecretRecipeItem[];
  };
}

/** Autocomplete suggestions response from FatSecret API */
export interface FatSecretAutocompleteResponse {
  suggestions?: {
    suggestion?: string | string[] | { suggestion: string }[];
  };
}

/** OAuth token response */
export interface FatSecretTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Public Types (re-exported from shared food-data-types)
// ============================================================================

export type {
  FoodSearchResult,
  FoodDetails,
  FoodServing,
  RecipeSearchResult,
  RecipeDetails,
  RecipeIngredient,
  RecipeDirection,
} from '../food-data-types';
