/**
 * USDA FoodData Central API Adapter
 * Provides typed interface for food search and details using the USDA FDC API.
 * Uses Foundation and SR Legacy datasets for high-quality whole food nutrition data.
 *
 * Performance optimization: Uses LRU caches for search results and food details
 * to stay well within the 1,000 requests/hour rate limit.
 */

import { LRUCache } from 'lru-cache';
import { engineLogger } from '../utils/logger';
import { FoodSearchResult, FoodDetails, FoodServing } from './fatsecret';

// ============================================================================
// USDA API Response Types
// ============================================================================

/** Nutrient entry in search result foodNutrients array */
interface USDASearchNutrient {
  nutrientName: string;
  value: number;
  unitName: string;
}

/** Individual food item from USDA search results */
interface USDASearchFood {
  fdcId: number;
  description: string;
  foodNutrients: USDASearchNutrient[];
  brandName?: string;
  brandOwner?: string;
}

/** USDA search response shape */
interface USDASearchResponse {
  foods: USDASearchFood[];
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
  modifier: string;
  amount: number;
  measureUnit?: {
    name: string;
  };
}

/** USDA food detail response shape */
interface USDAFoodDetailResponse {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients: USDAFoodNutrient[];
  foodPortions?: USDAFoodPortion[];
}

// ============================================================================
// USDA Adapter
// ============================================================================

export class USDAAdapter {
  private apiKey: string;

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

    this.searchCache = new LRUCache<string, FoodSearchResult[]>({
      max: 500,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    this.foodCache = new LRUCache<string, FoodDetails>({
      max: 1000,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });
  }

  private isConfigured(): boolean {
    return !!(
      this.apiKey &&
      this.apiKey !== '...' &&
      !this.apiKey.includes('placeholder')
    );
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
              await new Promise(resolve => setTimeout(resolve, delay));
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
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('USDA API request failed after retries');
  }

  private async apiRequest(endpoint: string, params: Record<string, string>): Promise<any> {
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
  }

  async searchFoods(query: string, maxResults = 20): Promise<FoodSearchResult[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cacheKey = `${query.toLowerCase().trim()}:${maxResults}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      this.cacheStats.searchHits++;
      engineLogger.debug(`[USDA] Search cache HIT for "${query}" (total hits: ${this.cacheStats.searchHits})`);
      return cached;
    }

    this.cacheStats.searchMisses++;
    engineLogger.debug(`[USDA] Search cache MISS for "${query}" (total misses: ${this.cacheStats.searchMisses})`);

    const data = await this.apiRequest('foods/search', {
      query,
      pageSize: String(maxResults),
      dataType: 'Foundation,SR Legacy',
    }) as USDASearchResponse;

    const foods = data?.foods;
    if (!foods || foods.length === 0) {
      this.searchCache.set(cacheKey, []);
      return [];
    }

    const results: FoodSearchResult[] = foods.map((food: USDASearchFood) => {
      const nutrients = food.foodNutrients || [];

      const calories = nutrients.find(
        n => n.nutrientName.includes('Energy') && n.unitName === 'KCAL'
      )?.value;
      const protein = nutrients.find(n => n.nutrientName === 'Protein')?.value;
      const carbs = nutrients.find(n => n.nutrientName === 'Carbohydrate, by difference')?.value;
      const fat = nutrients.find(n => n.nutrientName === 'Total lipid (fat)')?.value;

      const description = `Per 100g - Calories: ${calories ?? '?'}kcal | Fat: ${fat ?? '?'}g | Carbs: ${carbs ?? '?'}g | Protein: ${protein ?? '?'}g`;

      return {
        foodId: String(food.fdcId),
        name: food.description,
        description,
        brandName: food.brandName || food.brandOwner || undefined,
      };
    });

    this.searchCache.set(cacheKey, results);
    return results;
  }

  async getFood(fdcId: string): Promise<FoodDetails> {
    if (!this.isConfigured()) {
      throw new Error('USDA food lookup requires a valid API key');
    }

    const cached = this.foodCache.get(fdcId);
    if (cached) {
      this.cacheStats.foodHits++;
      engineLogger.debug(`[USDA] Food cache HIT for ID "${fdcId}" (total hits: ${this.cacheStats.foodHits})`);
      return cached;
    }

    this.cacheStats.foodMisses++;
    engineLogger.debug(`[USDA] Food cache MISS for ID "${fdcId}" (total misses: ${this.cacheStats.foodMisses})`);

    const data = await this.apiRequest(`food/${fdcId}`, {}) as USDAFoodDetailResponse;

    if (!data) {
      throw new Error(`Food ${fdcId} not found`);
    }

    // Build nutrient map by USDA nutrient number
    const nutrientMap: Record<string, number> = {};
    for (const fn of data.foodNutrients || []) {
      const num = fn.nutrient?.number;
      if (num && fn.amount !== undefined) {
        nutrientMap[num] = fn.amount;
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
    const portions = data.foodPortions || [];
    portions.forEach((portion: USDAFoodPortion, index: number) => {
      if (portion.gramWeight > 0) {
        const gw = portion.gramWeight;
        const desc = `${portion.amount} ${portion.measureUnit?.name || portion.modifier || 'serving'} (${gw}g)`;

        servings.push({
          servingId: `usda-${fdcId}-portion-${index}`,
          servingDescription: desc,
          metricServingAmount: gw,
          metricServingUnit: 'g',
          calories: Math.round((nutrientMap['208'] || 0) * gw / 100),
          protein: Math.round(((nutrientMap['203'] || 0) * gw / 100) * 10) / 10,
          carbohydrate: Math.round(((nutrientMap['205'] || 0) * gw / 100) * 10) / 10,
          fat: Math.round(((nutrientMap['204'] || 0) * gw / 100) * 10) / 10,
          fiber: nutrientMap['291'] !== undefined
            ? Math.round((nutrientMap['291'] * gw / 100) * 10) / 10
            : undefined,
        });
      }
    });

    const result: FoodDetails = {
      foodId: String(data.fdcId),
      name: data.description,
      brandName: data.brandName || data.brandOwner || undefined,
      servings,
    };

    this.foodCache.set(fdcId, result);
    return result;
  }

  getCacheStats() {
    return {
      ...this.cacheStats,
      searchCacheSize: this.searchCache.size,
      foodCacheSize: this.foodCache.size,
    };
  }

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
}
