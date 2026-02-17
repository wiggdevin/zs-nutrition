/**
 * FatSecret Platform API Adapter
 * Provides typed interface for food and recipe search, autocomplete, and details.
 * Falls back to a comprehensive local food database when FatSecret credentials are unavailable.
 *
 * Performance optimizations:
 *   - LRU caches for food search, food details, recipe search, and recipe details
 *   - Circuit breaker to fast-fail when the FatSecret API is unresponsive
 */

import { OAuthManager } from './oauth';
import { FatSecretCache } from './cache';
import { fatSecretCircuitBreaker } from './circuit-breaker';
import { searchFoods, searchRecipes } from './search';
import { getFood, getFoodByBarcode, getRecipe } from './details';
import { autocomplete } from './autocomplete';
import type { FoodSearchResult, FoodDetails, RecipeSearchResult, RecipeDetails } from './types';

// Re-export all public types
export type {
  FoodSearchResult,
  FoodDetails,
  FoodServing,
  RecipeSearchResult,
  RecipeDetails,
  RecipeIngredient,
  RecipeDirection,
} from './types';

// Re-export circuit breaker for external monitoring
export { fatSecretCircuitBreaker } from './circuit-breaker';
export type { CircuitBreakerState } from './circuit-breaker';

// Re-export fallback databases for direct use
export { LocalFoodDatabase, LocalRecipeDatabase } from './local-fallback';

export class FatSecretAdapter {
  private oauth: OAuthManager;
  private cache: FatSecretCache;
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.oauth = new OAuthManager(clientId, clientSecret);
    this.cache = new FatSecretCache();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCaches() {
    this.cache.clear();
  }

  /** Returns the current circuit breaker state for health checks / monitoring */
  getCircuitBreakerState() {
    return fatSecretCircuitBreaker.getState();
  }

  private isConfigured(): boolean {
    return !!(
      this.clientId &&
      this.clientSecret &&
      this.clientId !== '...' &&
      this.clientSecret !== '...' &&
      !this.clientId.includes('placeholder')
    );
  }

  async searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): Promise<FoodSearchResult[]> {
    return searchFoods(this.oauth, this.cache, this.isConfigured(), query, maxResults, pageNumber);
  }

  async getFood(foodId: string): Promise<FoodDetails> {
    return getFood(this.oauth, this.cache, this.isConfigured(), foodId);
  }

  async getFoodByBarcode(barcode: string): Promise<FoodDetails | null> {
    return getFoodByBarcode(this.oauth, this.isConfigured(), (id) => this.getFood(id), barcode);
  }

  async searchRecipes(query: string, maxResults: number = 10): Promise<RecipeSearchResult[]> {
    return searchRecipes(this.oauth, this.cache, this.isConfigured(), query, maxResults);
  }

  async getRecipe(recipeId: string): Promise<RecipeDetails> {
    return getRecipe(this.oauth, this.cache, this.isConfigured(), recipeId);
  }

  async autocomplete(query: string): Promise<string[]> {
    return autocomplete(this.oauth, this.isConfigured(), query);
  }
}
