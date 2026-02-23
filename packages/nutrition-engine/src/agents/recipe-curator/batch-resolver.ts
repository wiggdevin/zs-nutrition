/**
 * BatchIngredientResolver — Batch-resolves ingredient names against food databases
 * before Agent 3 (RecipeCurator) generates the meal plan.
 *
 * Resolution order per ingredient:
 *   1. FoodAliasCache exact match → direct fdcId (sub-ms)
 *   2. LocalUSDA tsvector + trigram search (sub-ms)
 *   3. USDA API search (API call, only if <3 local matches)
 *   4. FatSecret search (API call, only if <3 total matches)
 *
 * Returns top 3 matches per ingredient with fdcId, description, source,
 * per100g nutrition data, and dataType.
 */

import pLimit from 'p-limit';
import type { LocalUSDAAdapter } from '../../adapters/usda-local';
import type { USDAAdapter } from '../../adapters/usda';
import type { FatSecretAdapter } from '../../adapters/fatsecret';
import type { FoodAliasCache } from '../../data/food-alias-cache';
import type { FoodSearchResult, FoodDetails } from '../../adapters/food-data-types';
import { engineLogger } from '../../utils/logger';

/** Per-100g nutrition snapshot for a resolved food */
export interface Per100gNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A single candidate match for an ingredient */
export interface ResolvedMatch {
  fdcId: number;
  description: string;
  source: 'alias' | 'local-usda' | 'usda-api' | 'fatsecret';
  per100g: Per100gNutrition;
  dataType: string;
}

/** Resolution result for a single ingredient */
export interface ResolvedIngredient {
  name: string;
  resolved: boolean;
  matches: ResolvedMatch[];
}

/** Input ingredient for batch resolution */
export interface IngredientInput {
  name: string;
  context?: string;
}

/** Max concurrent resolution tasks */
const RESOLVE_CONCURRENCY = 10;

/** Max ingredients to resolve in a single batch */
const MAX_INGREDIENTS = 60;

/** Max matches to return per ingredient */
const MAX_MATCHES_PER = 3;

/** Timeout for the entire batch resolution (ms) */
const BATCH_TIMEOUT_MS = 10_000;

export class BatchIngredientResolver {
  constructor(
    private localUsdaAdapter: LocalUSDAAdapter | undefined,
    private usdaAdapter: USDAAdapter,
    private fatSecretAdapter: FatSecretAdapter | undefined,
    private foodAliasCache: FoodAliasCache | undefined
  ) {}

  /**
   * Resolve a batch of ingredient names against all available food databases.
   * Never throws — returns `resolved: false` for any ingredient that fails.
   */
  async resolve(ingredients: IngredientInput[]): Promise<ResolvedIngredient[]> {
    if (ingredients.length === 0) return [];

    // Cap at MAX_INGREDIENTS
    const capped = ingredients.slice(0, MAX_INGREDIENTS);

    // Dedup by normalized name, preserving first occurrence order
    const seen = new Map<string, number>();
    const unique: IngredientInput[] = [];
    const indexMap: number[] = []; // maps capped index → unique index

    for (let i = 0; i < capped.length; i++) {
      const key = capped[i].name.trim().toLowerCase();
      if (seen.has(key)) {
        indexMap.push(seen.get(key)!);
      } else {
        seen.set(key, unique.length);
        indexMap.push(unique.length);
        unique.push(capped[i]);
      }
    }

    engineLogger.info(
      `[BatchResolver] Resolving ${unique.length} unique ingredients (${capped.length} total, ${capped.length - unique.length} deduped)`
    );

    const limit = pLimit(RESOLVE_CONCURRENCY);
    const startTime = Date.now();

    // Resolve all unique ingredients in parallel with timeout
    const settledResults = await Promise.allSettled(
      unique.map((ing) => limit(() => this.resolveOne(ing, startTime)))
    );

    const uniqueResults: ResolvedIngredient[] = settledResults.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      engineLogger.warn(
        `[BatchResolver] Failed to resolve "${unique[i].name}":`,
        result.reason instanceof Error ? result.reason.message : result.reason
      );
      return { name: unique[i].name, resolved: false, matches: [] };
    });

    // Map back to original order (deduped items reference the same result)
    const results: ResolvedIngredient[] = capped.map((ing, i) => ({
      ...uniqueResults[indexMap[i]],
      name: ing.name, // preserve original casing
    }));

    const resolvedCount = results.filter((r) => r.resolved).length;
    const elapsed = Date.now() - startTime;
    engineLogger.info(
      `[BatchResolver] Resolved ${resolvedCount}/${results.length} ingredients in ${elapsed}ms`
    );

    return results;
  }

  /**
   * Resolve a single ingredient against all sources.
   * Returns early if batch timeout is exceeded.
   */
  private async resolveOne(
    ing: IngredientInput,
    batchStartTime: number
  ): Promise<ResolvedIngredient> {
    const name = ing.name.trim();
    const searchName = name.toLowerCase().replace(/,/g, '');
    const matches: ResolvedMatch[] = [];

    // Check batch timeout
    if (Date.now() - batchStartTime > BATCH_TIMEOUT_MS) {
      return { name, resolved: false, matches: [] };
    }

    // 1. FoodAliasCache exact match
    if (this.foodAliasCache) {
      const alias = this.foodAliasCache.get(searchName);
      if (alias?.fdcId) {
        // Use pre-computed nutrition if available (skip food detail lookup)
        if (alias.per100g) {
          matches.push({
            fdcId: alias.fdcId,
            description: alias.canonicalName,
            source: 'alias',
            per100g: alias.per100g,
            dataType: 'alias-precomputed',
          });
        } else if (this.localUsdaAdapter) {
          // Fall back to food detail lookup
          try {
            const food = await this.localUsdaAdapter.getFood(String(alias.fdcId));
            const per100g = this.extractPer100g(food);
            if (per100g) {
              matches.push({
                fdcId: alias.fdcId,
                description: food.name,
                source: 'alias',
                per100g,
                dataType: 'alias-direct',
              });
            }
          } catch {
            // Alias fdcId lookup failed, continue to search
          }
        }
      }
    }

    // 2. LocalUSDA search
    if (this.localUsdaAdapter && matches.length < MAX_MATCHES_PER) {
      try {
        const localResults = await this.localUsdaAdapter.searchFoods(searchName, 5);
        await this.addMatchesFromSearch(
          localResults,
          (id) => this.localUsdaAdapter!.getFood(id),
          'local-usda',
          'LocalUSDA',
          matches
        );
      } catch (err) {
        engineLogger.warn(
          `[BatchResolver] LocalUSDA search failed for "${name}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // 3. USDA API search — only when no local DB is available
    if (!this.localUsdaAdapter && matches.length < MAX_MATCHES_PER) {
      // Check timeout before making API call
      if (Date.now() - batchStartTime <= BATCH_TIMEOUT_MS) {
        try {
          const usdaResults = await this.usdaAdapter.searchFoods(searchName, 5);
          await this.addMatchesFromSearch(
            usdaResults,
            (id) => this.usdaAdapter.getFood(id),
            'usda-api',
            'USDA-API',
            matches
          );
        } catch (err) {
          engineLogger.warn(
            `[BatchResolver] USDA API search failed for "${name}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    // 4. FatSecret search — only when no local DB is available
    if (!this.localUsdaAdapter && this.fatSecretAdapter && matches.length < MAX_MATCHES_PER) {
      if (Date.now() - batchStartTime <= BATCH_TIMEOUT_MS) {
        try {
          const fsResults = await this.fatSecretAdapter.searchFoods(searchName, 5);
          await this.addMatchesFromFatSecret(fsResults, matches);
        } catch (err) {
          engineLogger.warn(
            `[BatchResolver] FatSecret search failed for "${name}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    if (this.localUsdaAdapter && matches.length === 0) {
      engineLogger.warn(
        `[BatchResolver] LocalUSDA returned 0 matches for "${name}" — ingredient not in local DB`
      );
    }

    return {
      name,
      resolved: matches.length > 0,
      matches: matches.slice(0, MAX_MATCHES_PER),
    };
  }

  /**
   * Add matches from a USDA-style search (LocalUSDA or USDA API).
   * Fetches food details for per-100g nutrition extraction.
   */
  private async addMatchesFromSearch(
    searchResults: FoodSearchResult[],
    getFoodFn: (id: string) => Promise<FoodDetails>,
    source: 'local-usda' | 'usda-api',
    sourceName: string,
    matches: ResolvedMatch[]
  ): Promise<void> {
    // Deduplicate against already-matched fdcIds
    const existingIds = new Set(matches.map((m) => m.fdcId));

    for (const result of searchResults) {
      if (matches.length >= MAX_MATCHES_PER) break;

      const fdcId = parseInt(result.foodId, 10);
      if (isNaN(fdcId) || existingIds.has(fdcId)) continue;

      try {
        const food = await getFoodFn(result.foodId);
        const per100g = this.extractPer100g(food);
        if (per100g) {
          matches.push({
            fdcId,
            description: food.name,
            source,
            per100g,
            dataType: source === 'local-usda' ? 'Foundation/SR Legacy' : 'USDA-API',
          });
          existingIds.add(fdcId);
        }
      } catch {
        // Skip this result if food details fail
      }
    }
  }

  /**
   * Add matches from FatSecret search results.
   * FatSecret doesn't use fdcId, so we use a negative hash as placeholder.
   */
  private async addMatchesFromFatSecret(
    searchResults: FoodSearchResult[],
    matches: ResolvedMatch[]
  ): Promise<void> {
    if (!this.fatSecretAdapter) return;

    for (const result of searchResults) {
      if (matches.length >= MAX_MATCHES_PER) break;

      // Skip branded items for resolve-at-prompt-time (prefer generic)
      if (result.brandName) continue;

      try {
        const food = await this.fatSecretAdapter.getFood(result.foodId);
        const per100g = this.extractPer100g(food);
        if (per100g) {
          // Use a large offset to avoid collision with USDA fdcIds
          const pseudoFdcId = 9_000_000 + Math.abs(hashCode(result.foodId));
          matches.push({
            fdcId: pseudoFdcId,
            description: food.name,
            source: 'fatsecret',
            per100g,
            dataType: 'FatSecret',
          });
        }
      } catch {
        // Skip this result
      }
    }
  }

  /**
   * Extract per-100g nutrition from a food's serving data.
   * Looks for a serving with gram metadata and normalizes to 100g.
   */
  private extractPer100g(food: FoodDetails): Per100gNutrition | null {
    if (food.servings.length === 0) return null;

    // Prefer a serving with explicit gram weight
    for (const s of food.servings) {
      const grams =
        s.metricServingUnit === 'g' && s.metricServingAmount
          ? s.metricServingAmount
          : s.metricServingUnit === 'ml' && s.metricServingAmount
            ? s.metricServingAmount // approximate 1ml ≈ 1g for resolution purposes
            : null;

      if (grams && grams > 0 && s.calories > 0) {
        const scale = 100 / grams;
        return {
          kcal: Math.round(s.calories * scale * 10) / 10,
          proteinG: Math.round(s.protein * scale * 10) / 10,
          carbsG: Math.round(s.carbohydrate * scale * 10) / 10,
          fatG: Math.round(s.fat * scale * 10) / 10,
        };
      }
    }

    // Fallback: if any serving has a "per 100g" description
    for (const s of food.servings) {
      const desc = s.servingDescription.toLowerCase();
      if (desc.includes('100g') || desc.includes('100 g')) {
        return {
          kcal: Math.round(s.calories * 10) / 10,
          proteinG: Math.round(s.protein * 10) / 10,
          carbsG: Math.round(s.carbohydrate * 10) / 10,
          fatG: Math.round(s.fat * 10) / 10,
        };
      }
    }

    // Last resort: use the first serving and assume ~100g portion
    const first = food.servings[0];
    if (first.calories > 0) {
      return {
        kcal: Math.round(first.calories * 10) / 10,
        proteinG: Math.round(first.protein * 10) / 10,
        carbsG: Math.round(first.carbohydrate * 10) / 10,
        fatG: Math.round(first.fat * 10) / 10,
      };
    }

    return null;
  }
}

/** Simple string hash for generating pseudo fdcIds from FatSecret foodIds */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
