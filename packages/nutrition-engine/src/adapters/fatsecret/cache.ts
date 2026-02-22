/**
 * FatSecret LRU cache management with optional L2 (Redis) cache.
 * Provides food search, food detail, recipe search, and recipe detail caching
 * to reduce redundant API calls.
 *
 * L1: In-memory LRU cache (fast, per-process)
 * L2: Optional external cache e.g. Redis (shared across processes/deploys)
 */

import { LRUCache } from 'lru-cache';
import { engineLogger } from '../../utils/logger';
import type { ExternalFoodCache } from '../food-data-types';
import type { FoodSearchResult, FoodDetails, RecipeSearchResult, RecipeDetails } from './types';

export interface CacheStats {
  searchHits: number;
  searchMisses: number;
  foodHits: number;
  foodMisses: number;
  recipeSearchHits: number;
  recipeSearchMisses: number;
  recipeHits: number;
  recipeMisses: number;
}

export class FatSecretCache {
  private searchCache: LRUCache<string, FoodSearchResult[]>;
  private foodCache: LRUCache<string, FoodDetails>;
  private recipeSearchCache: LRUCache<string, RecipeSearchResult[]>;
  private recipeCache: LRUCache<string, RecipeDetails>;
  private externalCache?: ExternalFoodCache;
  private stats: CacheStats = {
    searchHits: 0,
    searchMisses: 0,
    foodHits: 0,
    foodMisses: 0,
    recipeSearchHits: 0,
    recipeSearchMisses: 0,
    recipeHits: 0,
    recipeMisses: 0,
  };

  constructor(externalCache?: ExternalFoodCache) {
    this.externalCache = externalCache;

    // Initialize food search cache: 500 entries, 1-hour TTL
    this.searchCache = new LRUCache<string, FoodSearchResult[]>({
      max: 500,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    // Initialize food details cache: 1000 entries, 24-hour TTL
    this.foodCache = new LRUCache<string, FoodDetails>({
      max: 1000,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });

    // Initialize recipe search cache: 200 entries, 1-hour TTL
    this.recipeSearchCache = new LRUCache<string, RecipeSearchResult[]>({
      max: 200,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    // Initialize recipe details cache: 200 entries, 1-hour TTL
    this.recipeCache = new LRUCache<string, RecipeDetails>({
      max: 200,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  // -- Food search cache --

  async getSearchResult(cacheKey: string): Promise<FoodSearchResult[] | undefined> {
    // L1 check
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      this.stats.searchHits++;
      engineLogger.debug(
        `[FatSecret] Search cache L1 HIT for "${cacheKey}" (total hits: ${this.stats.searchHits})`
      );
      return cached;
    }

    // L2 check
    if (this.externalCache) {
      try {
        const l2Data = await this.externalCache.get(`fs:search:${cacheKey}`);
        if (l2Data) {
          const parsed = JSON.parse(l2Data) as FoodSearchResult[];
          this.searchCache.set(cacheKey, parsed); // backfill L1
          this.stats.searchHits++;
          engineLogger.debug(`[FatSecret] Search cache L2 HIT for "${cacheKey}"`);
          return parsed;
        }
      } catch {
        // L2 failure is non-fatal
      }
    }

    this.stats.searchMisses++;
    engineLogger.debug(
      `[FatSecret] Search cache MISS for "${cacheKey}" (total misses: ${this.stats.searchMisses})`
    );
    return undefined;
  }

  async setSearchResult(cacheKey: string, results: FoodSearchResult[]): Promise<void> {
    this.searchCache.set(cacheKey, results);
    if (this.externalCache) {
      try {
        await this.externalCache.set(`fs:search:${cacheKey}`, JSON.stringify(results), 3600); // 1h
      } catch {
        // L2 failure is non-fatal
      }
    }
  }

  // -- Food details cache --

  async getFoodResult(foodId: string): Promise<FoodDetails | undefined> {
    // L1 check
    const cached = this.foodCache.get(foodId);
    if (cached) {
      this.stats.foodHits++;
      engineLogger.debug(
        `[FatSecret] Food cache L1 HIT for ID "${foodId}" (total hits: ${this.stats.foodHits})`
      );
      return cached;
    }

    // L2 check
    if (this.externalCache) {
      try {
        const l2Data = await this.externalCache.get(`fs:food:${foodId}`);
        if (l2Data) {
          const parsed = JSON.parse(l2Data) as FoodDetails;
          this.foodCache.set(foodId, parsed); // backfill L1
          this.stats.foodHits++;
          engineLogger.debug(`[FatSecret] Food cache L2 HIT for ID "${foodId}"`);
          return parsed;
        }
      } catch {
        // L2 failure is non-fatal
      }
    }

    this.stats.foodMisses++;
    engineLogger.debug(
      `[FatSecret] Food cache MISS for ID "${foodId}" (total misses: ${this.stats.foodMisses})`
    );
    return undefined;
  }

  async setFoodResult(foodId: string, details: FoodDetails): Promise<void> {
    this.foodCache.set(foodId, details);
    if (this.externalCache) {
      try {
        await this.externalCache.set(`fs:food:${foodId}`, JSON.stringify(details), 86400); // 24h
      } catch {
        // L2 failure is non-fatal
      }
    }
  }

  // -- Recipe search cache --

  getRecipeSearch(query: string): RecipeSearchResult[] | undefined {
    const cached = this.recipeSearchCache.get(query);
    if (cached) {
      this.stats.recipeSearchHits++;
      engineLogger.debug(
        `[FatSecret] Recipe search cache HIT for "${query}" (total hits: ${this.stats.recipeSearchHits})`
      );
    } else {
      this.stats.recipeSearchMisses++;
      engineLogger.debug(
        `[FatSecret] Recipe search cache MISS for "${query}" (total misses: ${this.stats.recipeSearchMisses})`
      );
    }
    return cached;
  }

  setRecipeSearch(query: string, results: RecipeSearchResult[]): void {
    this.recipeSearchCache.set(query, results);
  }

  // -- Recipe details cache --

  getRecipe(recipeId: string): RecipeDetails | undefined {
    const cached = this.recipeCache.get(recipeId);
    if (cached) {
      this.stats.recipeHits++;
      engineLogger.debug(
        `[FatSecret] Recipe cache HIT for ID "${recipeId}" (total hits: ${this.stats.recipeHits})`
      );
    } else {
      this.stats.recipeMisses++;
      engineLogger.debug(
        `[FatSecret] Recipe cache MISS for ID "${recipeId}" (total misses: ${this.stats.recipeMisses})`
      );
    }
    return cached;
  }

  setRecipe(recipeId: string, details: RecipeDetails): void {
    this.recipeCache.set(recipeId, details);
  }

  // -- Stats & management --

  getStats() {
    return {
      ...this.stats,
      searchCacheSize: this.searchCache.size,
      foodCacheSize: this.foodCache.size,
      recipeSearchCacheSize: this.recipeSearchCache.size,
      recipeCacheSize: this.recipeCache.size,
    };
  }

  clear(): void {
    this.searchCache.clear();
    this.foodCache.clear();
    this.recipeSearchCache.clear();
    this.recipeCache.clear();
    this.stats = {
      searchHits: 0,
      searchMisses: 0,
      foodHits: 0,
      foodMisses: 0,
      recipeSearchHits: 0,
      recipeSearchMisses: 0,
      recipeHits: 0,
      recipeMisses: 0,
    };
    engineLogger.info('[FatSecret] Caches cleared');
  }
}
