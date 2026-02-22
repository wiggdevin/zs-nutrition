/**
 * USDA FoodData Central API Adapter
 * Provides typed interface for food search and details using the USDA FDC API.
 * Uses Foundation and SR Legacy datasets for high-quality whole food nutrition data.
 *
 * Performance optimization: Uses LRU caches for search results and food details
 * to avoid redundant API calls. Rate limit: 1,000 requests/hour per IP.
 */

import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import { engineLogger } from '../utils/logger';
import { CircuitBreaker } from './fatsecret/circuit-breaker';
import { FoodSearchResult, FoodDetails, FoodServing } from './food-data-types';

/**
 * Module-level circuit breaker for USDA API calls.
 * Configuration: 5 failures to open, 30s reset, 10s per-request timeout.
 */
export const usdaCircuitBreaker = new CircuitBreaker(5, 30_000, 10_000, 'USDA');

// ============================================================================
// USDA API Response Types
// ============================================================================

/** Nutrient entry in search result foods */
interface USDASearchNutrient {
  nutrientName: string;
  value: number;
  unitName: string;
}

/** Individual food item from USDA search results */
interface USDASearchFoodItem {
  fdcId: number;
  description: string;
  foodNutrients: USDASearchNutrient[];
  brandName?: string;
  brandOwner?: string;
}

/** Nutrient detail in food detail response */
interface USDAFoodNutrient {
  nutrient: {
    name: string;
    unitName: string;
    number: string;
  };
  amount: number;
}

/** Portion entry in food detail response */
interface USDAFoodPortion {
  gramWeight: number;
  modifier?: string;
  amount?: number;
  measureUnit?: {
    name?: string;
  };
}

export class USDAAdapter {
  private apiKey: string;
  private readonly apiLimit = pLimit(5);

  private searchCache: LRUCache<string, FoodSearchResult[]>;
  private foodCache: LRUCache<string, FoodDetails>;

  private cacheStats = {
    searchHits: 0,
    searchMisses: 0,
    foodHits: 0,
    foodMisses: 0,
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    // Initialize search cache: 500 entries, 1-hour TTL
    this.searchCache = new LRUCache<string, FoodSearchResult[]>({
      max: 500,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    // Initialize food details cache: 1000 entries, 24-hour TTL
    this.foodCache = new LRUCache<string, FoodDetails>({
      max: 1000,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });
  }

  /**
   * Get current cache statistics for monitoring/debugging
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      searchCacheSize: this.searchCache.size,
      foodCacheSize: this.foodCache.size,
    };
  }

  /**
   * Clear all caches (useful for testing or forced refresh)
   */
  clearCaches() {
    this.searchCache.clear();
    this.foodCache.clear();
    this.cacheStats = {
      searchHits: 0,
      searchMisses: 0,
      foodHits: 0,
      foodMisses: 0,
    };
    engineLogger.info('[USDA] Caches cleared');
  }

  private isConfigured(): boolean {
    return !!(this.apiKey && this.apiKey !== '...' && !this.apiKey.includes('placeholder'));
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 2,
    timeoutMs = 10000
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, { ...options, signal: controller.signal });

          if (response.status === 429 || response.status >= 500) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter
              ? parseInt(retryAfter) * 1000
              : Math.pow(2, attempt) * 1000 + Math.random() * 500;

            if (attempt < maxRetries) {
              engineLogger.warn(
                `[USDA] ${response.status} on attempt ${attempt + 1}, retrying in ${Math.round(delay)}ms`
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }

          return response;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          engineLogger.warn(
            `[USDA] Network error on attempt ${attempt + 1}, retrying in ${delay}ms: ${(error as Error).message}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('USDA API request failed after retries');
  }

  private async apiRequest(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    return usdaCircuitBreaker.execute(async () => {
      const url = new URL(`https://api.nal.usda.gov/fdc/v1/${endpoint}`);
      url.searchParams.set('api_key', this.apiKey);
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }

      const response = await this.fetchWithRetry(url.toString(), {});

      if (!response.ok) {
        throw new Error(`USDA API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    });
  }

  async searchFoods(query: string, maxResults: number = 20): Promise<FoodSearchResult[]> {
    return this.apiLimit(async () => {
      if (!this.isConfigured()) {
        return [];
      }

      // Check cache first
      const cacheKey = `${query.toLowerCase().trim()}:${maxResults}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached) {
        this.cacheStats.searchHits++;
        engineLogger.debug(
          `[USDA] Search cache HIT for "${query}" (total hits: ${this.cacheStats.searchHits})`
        );
        return cached;
      }

      this.cacheStats.searchMisses++;
      engineLogger.debug(
        `[USDA] Search cache MISS for "${query}" (total misses: ${this.cacheStats.searchMisses})`
      );

      const data = await this.apiRequest('foods/search', {
        query,
        pageSize: String(maxResults),
        dataType: 'Foundation,SR Legacy',
      });

      const foods: USDASearchFoodItem[] = data?.foods;
      if (!foods || !Array.isArray(foods) || foods.length === 0) {
        // Cache empty results too to avoid repeated failed lookups
        this.searchCache.set(cacheKey, []);
        return [];
      }

      const results: FoodSearchResult[] = foods.map((food) => {
        // Extract macros from foodNutrients for the description
        const nutrients = food.foodNutrients || [];
        const calories = nutrients.find(
          (n) =>
            (n.nutrientName === 'Energy' || n.nutrientName.includes('Energy')) &&
            n.unitName === 'KCAL'
        )?.value;
        const protein = nutrients.find((n) => n.nutrientName === 'Protein')?.value;
        const carbs = nutrients.find(
          (n) => n.nutrientName === 'Carbohydrate, by difference'
        )?.value;
        const fat = nutrients.find((n) => n.nutrientName === 'Total lipid (fat)')?.value;

        const description = `Per 100g - Calories: ${calories ?? 0}kcal | Fat: ${fat ?? 0}g | Carbs: ${carbs ?? 0}g | Protein: ${protein ?? 0}g`;

        return {
          foodId: String(food.fdcId),
          name: food.description,
          description,
          brandName: food.brandName || food.brandOwner || undefined,
        };
      });

      // Store in cache
      this.searchCache.set(cacheKey, results);
      return results;
    });
  }

  async getFood(fdcId: string): Promise<FoodDetails> {
    return this.apiLimit(async () => {
      if (!this.isConfigured()) {
        throw new Error('USDA food lookup requires a valid API key');
      }

      // Check cache first
      const cached = this.foodCache.get(fdcId);
      if (cached) {
        this.cacheStats.foodHits++;
        engineLogger.debug(
          `[USDA] Food cache HIT for ID "${fdcId}" (total hits: ${this.cacheStats.foodHits})`
        );
        return cached;
      }

      this.cacheStats.foodMisses++;
      engineLogger.debug(
        `[USDA] Food cache MISS for ID "${fdcId}" (total misses: ${this.cacheStats.foodMisses})`
      );

      const data = await this.apiRequest(`food/${fdcId}`);

      if (!data) {
        throw new Error(`Food ${fdcId} not found`);
      }

      // Build nutrient map from detailed response
      const foodNutrients: USDAFoodNutrient[] = data.foodNutrients || [];
      const nutrientMap: Record<string, number> = {};
      for (const fn of foodNutrients) {
        if (fn.nutrient?.number && fn.amount !== undefined) {
          nutrientMap[fn.nutrient.number] = fn.amount;
        }
      }

      // Primary serving: always per 100g for Foundation/SR Legacy data
      const primaryServing: FoodServing = {
        servingId: `usda-${fdcId}-100g`,
        servingDescription: '100g',
        metricServingAmount: 100,
        metricServingUnit: 'g',
        calories: nutrientMap['208'] || 0,
        protein: nutrientMap['203'] || 0,
        carbohydrate: nutrientMap['205'] || 0,
        fat: nutrientMap['204'] || 0,
        fiber: nutrientMap['291'] ?? undefined,
      };

      const servings: FoodServing[] = [primaryServing];

      // Build additional servings from foodPortions
      const portions: USDAFoodPortion[] = data.foodPortions || [];
      portions.forEach((portion, index) => {
        if (portion.gramWeight > 0) {
          const gw = portion.gramWeight;
          const desc = `${portion.amount || 1} ${portion.measureUnit?.name || portion.modifier || 'serving'} (${gw}g)`;

          servings.push({
            servingId: `usda-${fdcId}-portion-${index}`,
            servingDescription: desc,
            metricServingAmount: gw,
            metricServingUnit: 'g',
            calories: Math.round(((nutrientMap['208'] || 0) * gw) / 100),
            protein: Math.round((((nutrientMap['203'] || 0) * gw) / 100) * 10) / 10,
            carbohydrate: Math.round((((nutrientMap['205'] || 0) * gw) / 100) * 10) / 10,
            fat: Math.round((((nutrientMap['204'] || 0) * gw) / 100) * 10) / 10,
            fiber:
              nutrientMap['291'] !== undefined
                ? Math.round(((nutrientMap['291'] * gw) / 100) * 10) / 10
                : undefined,
          });
        }
      });

      const result: FoodDetails = {
        foodId: String(data.fdcId || fdcId),
        name: data.description || `USDA Food ${fdcId}`,
        brandName: data.brandName || data.brandOwner || undefined,
        servings,
      };

      // Store in cache
      this.foodCache.set(fdcId, result);
      return result;
    });
  }
}
