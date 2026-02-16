/**
 * FatSecret food and recipe search methods
 */

import { OAuthManager, apiRequest } from './oauth';
import { FatSecretCache } from './cache';
import { LocalFoodDatabase, LocalRecipeDatabase } from './local-fallback';
import type {
  FoodSearchResult,
  RecipeSearchResult,
  FatSecretSearchResponse,
  FatSecretFoodItem,
  FatSecretRecipeSearchResponse,
  FatSecretRecipeItem,
} from './types';

export async function searchFoods(
  oauth: OAuthManager,
  cache: FatSecretCache,
  isConfigured: boolean,
  query: string,
  maxResults: number = 20,
  pageNumber: number = 0
): Promise<FoodSearchResult[]> {
  if (!isConfigured) {
    return LocalFoodDatabase.searchFoods(query, maxResults, pageNumber);
  }

  // Check cache first
  const cacheKey = `${query.toLowerCase().trim()}:${maxResults}:${pageNumber}`;
  const cached = cache.getSearchResult(cacheKey);
  if (cached) {
    return cached;
  }

  const data = (await apiRequest(oauth, 'foods.search', {
    search_expression: query,
    max_results: String(maxResults),
    page_number: String(pageNumber),
  })) as FatSecretSearchResponse;

  const foods = data?.foods?.food;
  if (!foods) {
    // Cache empty results too to avoid repeated failed lookups
    cache.setSearchResult(cacheKey, []);
    return [];
  }

  const foodArray = Array.isArray(foods) ? foods : [foods];
  const results = foodArray.map((f: FatSecretFoodItem) => ({
    foodId: String(f.food_id),
    name: f.food_name,
    description: f.food_description || '',
    brandName: f.brand_name || undefined,
  }));

  // Store in cache
  cache.setSearchResult(cacheKey, results);
  return results;
}

export async function searchRecipes(
  oauth: OAuthManager,
  isConfigured: boolean,
  query: string,
  maxResults: number = 10
): Promise<RecipeSearchResult[]> {
  if (!isConfigured) {
    return LocalRecipeDatabase.searchRecipes(query, maxResults);
  }

  const data = (await apiRequest(oauth, 'recipes.search', {
    search_expression: query,
    max_results: String(maxResults),
  })) as FatSecretRecipeSearchResponse;

  const recipes = data?.recipes?.recipe;
  if (!recipes) {
    return [];
  }

  const arr = Array.isArray(recipes) ? recipes : [recipes];
  return arr.map((r: FatSecretRecipeItem) => ({
    recipeId: String(r.recipe_id),
    name: r.recipe_name,
    description: r.recipe_description || '',
    preparationTimeMin: r.preparation_time_min ? Number(r.preparation_time_min) : undefined,
    cookingTimeMin: r.cooking_time_min ? Number(r.cooking_time_min) : undefined,
  }));
}
