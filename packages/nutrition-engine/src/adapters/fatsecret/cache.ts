/**
 * FatSecret LRU cache management
 * Provides search and food detail caching to reduce redundant API calls.
 */

import { LRUCache } from 'lru-cache';
import { engineLogger } from '../../utils/logger';
import type { FoodSearchResult, FoodDetails } from './types';

export interface CacheStats {
  searchHits: number;
  searchMisses: number;
  foodHits: number;
  foodMisses: number;
}

export class FatSecretCache {
  private searchCache: LRUCache<string, FoodSearchResult[]>;
  private foodCache: LRUCache<string, FoodDetails>;
  private stats: CacheStats = {
    searchHits: 0,
    searchMisses: 0,
    foodHits: 0,
    foodMisses: 0,
  };

  constructor() {
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

  getStats() {
    return {
      ...this.stats,
      searchCacheSize: this.searchCache.size,
      foodCacheSize: this.foodCache.size,
    };
  }

  clear(): void {
    this.searchCache.clear();
    this.foodCache.clear();
    this.stats = {
      searchHits: 0,
      searchMisses: 0,
      foodHits: 0,
      foodMisses: 0,
    };
    engineLogger.info('[FatSecret] Caches cleared');
  }
}
