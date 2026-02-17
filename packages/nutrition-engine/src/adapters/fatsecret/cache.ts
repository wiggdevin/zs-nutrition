/**
 * FatSecret LRU cache management
 * Provides food search, food detail, recipe search, and recipe detail caching
 * to reduce redundant API calls.
 */

import { LRUCache } from 'lru-cache';
import { engineLogger } from '../../utils/logger';
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

  constructor() {
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

  getSearchResult(cacheKey: string): FoodSearchResult[] | undefined {
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      this.stats.searchHits++;
      engineLogger.debug(
        `[FatSecret] Search cache HIT for "${cacheKey}" (total hits: ${this.stats.searchHits})`
      );
    } else {
      this.stats.searchMisses++;
      engineLogger.debug(
        `[FatSecret] Search cache MISS for "${cacheKey}" (total misses: ${this.stats.searchMisses})`
      );
    }
    return cached;
  }

  setSearchResult(cacheKey: string, results: FoodSearchResult[]): void {
    this.searchCache.set(cacheKey, results);
  }

  // -- Food details cache --

  getFoodResult(foodId: string): FoodDetails | undefined {
    const cached = this.foodCache.get(foodId);
    if (cached) {
      this.stats.foodHits++;
      engineLogger.debug(
        `[FatSecret] Food cache HIT for ID "${foodId}" (total hits: ${this.stats.foodHits})`
      );
    } else {
      this.stats.foodMisses++;
      engineLogger.debug(
        `[FatSecret] Food cache MISS for ID "${foodId}" (total misses: ${this.stats.foodMisses})`
      );
    }
    return cached;
  }

  setFoodResult(foodId: string, details: FoodDetails): void {
    this.foodCache.set(foodId, details);
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
