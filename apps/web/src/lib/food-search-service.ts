/**
 * FoodSearchService — Central routing service for food search with ID namespacing.
 *
 * Routes search requests to LocalUSDAAdapter (primary, sub-5ms)
 * with FatSecret as optional fallback for branded foods.
 *
 * ID namespacing:
 *   - "usda:171534"   → LocalUSDAAdapter (fdcId = 171534)
 *   - "fs:1234567"    → FatSecretAdapter (foodId = 1234567)
 *   - "1234567"       → Legacy FatSecret (no prefix, backward compat)
 */

import { prisma } from './prisma';
import { LocalUSDAAdapter, FatSecretAdapter } from '@zero-sum/nutrition-engine';
import type { FoodSearchResult, FoodDetails, ExternalFoodCache } from '@zero-sum/nutrition-engine';
import { redis } from './redis';
import { logger } from './safe-logger';

// Singleton LocalUSDAAdapter
let localAdapter: LocalUSDAAdapter | null = null;

function getLocalAdapter(): LocalUSDAAdapter {
  if (!localAdapter) {
    localAdapter = new LocalUSDAAdapter(prisma);
  }
  return localAdapter;
}

/** Thin Redis wrapper implementing ExternalFoodCache for L2 caching. */
const redisFoodCache: ExternalFoodCache = {
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (err) {
      logger.warn('[FoodSearchCache L2] GET failed:', err);
      return null;
    }
  },
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn('[FoodCache L2] SET failed:', err);
    }
  },
};

// Singleton FatSecretAdapter (only used for legacy/branded food lookups)
let fatSecretAdapter: FatSecretAdapter | null = null;

function getFatSecretAdapter(): FatSecretAdapter {
  if (!fatSecretAdapter) {
    fatSecretAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || '',
      redisFoodCache
    );
  }
  return fatSecretAdapter;
}

/** Parse a namespaced food ID into source + raw ID */
export function parseNamespacedId(namespacedId: string): {
  source: 'usda' | 'fatsecret';
  rawId: string;
} {
  if (namespacedId.startsWith('usda:')) {
    return { source: 'usda', rawId: namespacedId.slice(5) };
  }
  if (namespacedId.startsWith('fs:')) {
    return { source: 'fatsecret', rawId: namespacedId.slice(3) };
  }
  // Legacy: no prefix → treat as FatSecret
  return { source: 'fatsecret', rawId: namespacedId };
}

/** Prefix a USDA foodId with the namespace */
function prefixUsda(foodId: string): string {
  return `usda:${foodId}`;
}

/**
 * Search foods using LocalUSDAAdapter.
 * Results come back with `usda:` prefixed IDs.
 */
export async function searchFoods(
  query: string,
  maxResults: number = 20,
  page: number = 0
): Promise<{ results: FoodSearchResult[]; page: number; hasMore: boolean }> {
  const adapter = getLocalAdapter();
  const foods = await adapter.searchFoods(query, maxResults, page);

  // Prefix IDs with usda: namespace
  const prefixed = foods.map((f) => ({
    ...f,
    foodId: prefixUsda(f.foodId),
  }));

  return {
    results: prefixed,
    page,
    hasMore: foods.length === maxResults,
  };
}

/**
 * Autocomplete: returns food description strings for typeahead.
 */
export async function autocomplete(query: string, maxResults: number = 10): Promise<string[]> {
  const adapter = getLocalAdapter();
  return adapter.autocomplete(query, maxResults);
}

/**
 * Get food details by namespaced ID.
 * Routes to correct adapter based on prefix.
 */
export async function getFood(namespacedId: string): Promise<FoodDetails> {
  const { source, rawId } = parseNamespacedId(namespacedId);

  if (source === 'usda') {
    const adapter = getLocalAdapter();
    const details = await adapter.getFood(rawId);
    return {
      ...details,
      foodId: prefixUsda(details.foodId),
    };
  }

  // FatSecret path (legacy or fs: prefix)
  const fatSecret = getFatSecretAdapter();
  return fatSecret.getFood(rawId);
}

/**
 * Determine the tracking source from a namespaced food ID.
 */
export function sourceFromFoodId(foodId: string): 'usda_search' | 'fatsecret_search' {
  return foodId.startsWith('usda:') ? 'usda_search' : 'fatsecret_search';
}
