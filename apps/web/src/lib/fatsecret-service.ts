/**
 * FatSecret Service
 *
 * Unified service that automatically routes FatSecret API calls:
 * - In production with proxy configured: Uses Railway proxy (static IP for whitelisting)
 * - In local development: Uses direct FatSecretAdapter
 *
 * This abstraction allows seamless switching between environments while
 * providing the same interface to consumers.
 */

import { FatSecretAdapter } from '@zero-sum/nutrition-engine';
import { fatsecretProxy, isProxyConfigured } from './fatsecret-proxy';
import type {
  FoodSearchResult,
  FoodDetails,
  RecipeSearchResult,
  RecipeDetails,
} from '@zero-sum/nutrition-engine';

/**
 * Singleton direct adapter instance for local development
 */
let directAdapter: FatSecretAdapter | null = null;

function getDirectAdapter(): FatSecretAdapter {
  if (!directAdapter) {
    directAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    );
  }
  return directAdapter;
}

/**
 * Determine if we should use the proxy
 * Use proxy only in production AND when proxy is configured
 */
function shouldUseProxy(): boolean {
  return process.env.NODE_ENV === 'production' && isProxyConfigured();
}

/**
 * Unified FatSecret Service Interface
 */
export interface FatSecretService {
  searchFoods(query: string, maxResults?: number, pageNumber?: number): Promise<FoodSearchResult[]>;
  getFood(foodId: string): Promise<FoodDetails>;
  autocomplete(query: string): Promise<string[]>;
  getFoodByBarcode(barcode: string): Promise<FoodDetails | null>;
  searchRecipes(query: string, maxResults?: number): Promise<RecipeSearchResult[]>;
  getRecipe(recipeId: string): Promise<RecipeDetails>;
}

/**
 * FatSecret service that automatically chooses between proxy and direct access
 */
export const fatsecretService: FatSecretService = {
  async searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): Promise<FoodSearchResult[]> {
    if (shouldUseProxy()) {
      return fatsecretProxy.searchFoods(query, maxResults, pageNumber);
    }
    return getDirectAdapter().searchFoods(query, maxResults, pageNumber);
  },

  async getFood(foodId: string): Promise<FoodDetails> {
    if (shouldUseProxy()) {
      return fatsecretProxy.getFood(foodId);
    }
    return getDirectAdapter().getFood(foodId);
  },

  async autocomplete(query: string): Promise<string[]> {
    if (shouldUseProxy()) {
      return fatsecretProxy.autocomplete(query);
    }
    return getDirectAdapter().autocomplete(query);
  },

  async getFoodByBarcode(barcode: string): Promise<FoodDetails | null> {
    if (shouldUseProxy()) {
      return fatsecretProxy.getFoodByBarcode(barcode);
    }
    return getDirectAdapter().getFoodByBarcode(barcode);
  },

  async searchRecipes(query: string, maxResults: number = 10): Promise<RecipeSearchResult[]> {
    if (shouldUseProxy()) {
      return fatsecretProxy.searchRecipes(query, maxResults);
    }
    return getDirectAdapter().searchRecipes(query, maxResults);
  },

  async getRecipe(recipeId: string): Promise<RecipeDetails> {
    if (shouldUseProxy()) {
      return fatsecretProxy.getRecipe(recipeId);
    }
    return getDirectAdapter().getRecipe(recipeId);
  },
};

/**
 * Export for checking which mode is active (useful for debugging)
 */
export function getFatSecretMode(): 'proxy' | 'direct' {
  return shouldUseProxy() ? 'proxy' : 'direct';
}
