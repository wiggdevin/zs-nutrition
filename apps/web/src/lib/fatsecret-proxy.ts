/**
 * FatSecret Proxy Client
 *
 * Makes authenticated requests to the Railway-hosted FatSecret proxy.
 * This solves IP whitelisting issues by routing through Railway's static IP.
 */

import type {
  FoodSearchResult,
  FoodDetails,
  RecipeSearchResult,
  RecipeDetails,
} from '@zero-sum/nutrition-engine';

const PROXY_URL = process.env.FATSECRET_PROXY_URL;
const PROXY_SECRET = process.env.FATSECRET_PROXY_SECRET;

/**
 * Check if the proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!(PROXY_URL && PROXY_SECRET);
}

/**
 * Make an authenticated POST request to the proxy
 */
async function proxyRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!PROXY_URL || !PROXY_SECRET) {
    throw new Error('FatSecret proxy not configured');
  }

  const url = `${PROXY_URL}/fatsecret${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROXY_SECRET}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy request failed: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * FatSecret Proxy Client
 * Provides the same interface as FatSecretAdapter but routes through the proxy.
 */
export const fatsecretProxy = {
  /**
   * Search foods by query
   */
  async searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): Promise<FoodSearchResult[]> {
    const data = await proxyRequest<{ results: FoodSearchResult[]; pageNumber: number }>(
      '/search',
      { query, maxResults, pageNumber }
    );
    return data.results;
  },

  /**
   * Get food details by ID
   */
  async getFood(foodId: string): Promise<FoodDetails> {
    const data = await proxyRequest<{ food: FoodDetails }>('/food', { foodId });
    return data.food;
  },

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(query: string): Promise<string[]> {
    const data = await proxyRequest<{ suggestions: string[] }>('/autocomplete', { query });
    return data.suggestions;
  },

  /**
   * Get food by barcode
   */
  async getFoodByBarcode(barcode: string): Promise<FoodDetails | null> {
    try {
      const data = await proxyRequest<{ food: FoodDetails }>('/barcode', { barcode });
      return data.food;
    } catch (error) {
      // Return null if food not found (404)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Search recipes by query
   */
  async searchRecipes(query: string, maxResults: number = 10): Promise<RecipeSearchResult[]> {
    const data = await proxyRequest<{ results: RecipeSearchResult[] }>(
      '/recipes/search',
      { query, maxResults }
    );
    return data.results;
  },

  /**
   * Get recipe details by ID
   */
  async getRecipe(recipeId: string): Promise<RecipeDetails> {
    const data = await proxyRequest<{ recipe: RecipeDetails }>('/recipes/details', { recipeId });
    return data.recipe;
  },
};
