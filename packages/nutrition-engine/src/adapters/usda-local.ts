/**
 * LocalUSDAAdapter — Sub-millisecond food lookups against the local UsdaFood table.
 *
 * Uses a composite scoring query (tsvector + trigram + bonuses) for ranked results.
 * Includes LRU caches for search results and food details to eliminate
 * redundant DB round-trips during compilation (140+ lookups per plan, many duped).
 *
 * Interface matches USDAAdapter exactly: searchFoods(query, maxResults), getFood(fdcId).
 */

import type { PrismaClient } from '@prisma/client';
import type { FoodSearchResult, FoodDetails, FoodServing } from './food-data-types';
import { engineLogger } from '../utils/logger';

// USDA nutrient number keys
const KCAL = '208';
const PROTEIN = '203';
const FAT = '204';
const CARBS = '205';
const FIBER = '291';

// ------- LRU Cache -------

class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  get size(): number {
    return this.cache.size;
  }
}

// ------- Common prefixes to strip for search variants -------

const STRIP_PREFIXES = [
  'fresh',
  'dried',
  'frozen',
  'organic',
  'whole',
  'diced',
  'sliced',
  'chopped',
  'minced',
  'grilled',
  'baked',
  'roasted',
  'steamed',
  'sauteed',
  'smoked',
  'canned',
  'pickled',
  'marinated',
];

/**
 * Generate search variants for a query when the primary query returns no results.
 * Tries:
 *   1. Query + " raw" (if no cooking state present)
 *   2. Strip common prefixes (fresh, organic, etc.)
 *   3. Base word only (before first comma or parenthetical)
 */
function generateSearchVariants(query: string): string[] {
  const variants: string[] = [];
  const lower = query.toLowerCase().trim();

  const hasCookingState = [
    'raw',
    'cooked',
    'baked',
    'roasted',
    'grilled',
    'steamed',
    'boiled',
    'fried',
    'dried',
    'canned',
    'smoked',
  ].some((s) => lower.includes(s));

  // 1. Try adding "raw" if no cooking state present
  if (!hasCookingState) {
    variants.push(`${lower} raw`);
  }

  // 2. Strip common prefixes
  const words = lower.split(/\s+/);
  if (words.length >= 2) {
    const stripped = words.filter((w) => !STRIP_PREFIXES.includes(w));
    if (stripped.length > 0 && stripped.length < words.length) {
      variants.push(stripped.join(' '));
    }
  }

  // 3. Base word only (before first comma)
  if (lower.includes(',')) {
    const base = lower.split(',')[0].trim();
    if (base.length >= 2 && base !== lower) {
      variants.push(base);
    }
  }

  return variants;
}

export class LocalUSDAAdapter {
  private searchCache = new LRUCache<string, UsdaFoodRow[]>(500, 30 * 60 * 1000); // 30min TTL
  private foodCache = new LRUCache<number, UsdaFoodRow>(500, 60 * 60 * 1000); // 1hr TTL

  constructor(private prisma: PrismaClient) {}

  async searchFoods(
    query: string,
    maxResults: number = 20,
    page: number = 0
  ): Promise<FoodSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const offset = page * maxResults;
    const cacheKey = `${trimmed.toLowerCase()}:${maxResults}:${page}`;

    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      engineLogger.debug(
        `[LocalUSDA] Cache HIT for "${trimmed}" (${cached.length} results, page ${page})`
      );
      return cached.map((row) => this.toSearchResult(row));
    }

    // Primary: composite search (tsvector + trigram scored together)
    let rows = await this.compositeSearch(trimmed, maxResults, offset);

    // Variant fallback: try search variants when primary returns nothing (page 0 only)
    if (rows.length === 0 && page === 0) {
      const variants = generateSearchVariants(trimmed);
      for (const variant of variants) {
        rows = await this.compositeSearch(variant, maxResults, offset);
        if (rows.length > 0) {
          engineLogger.debug(
            `[LocalUSDA] Variant HIT for "${trimmed}" via "${variant}" (${rows.length} results)`
          );
          break;
        }
      }
    }

    if (rows.length > 0) {
      engineLogger.debug(
        `[LocalUSDA] Search HIT for "${trimmed}" (${rows.length} results, page ${page})`
      );
    } else {
      engineLogger.debug(`[LocalUSDA] Search MISS for "${trimmed}"`);
    }

    // Cache the result
    this.searchCache.set(cacheKey, rows);

    return rows.map((row) => this.toSearchResult(row));
  }

  /**
   * Autocomplete: returns food description strings matching the query.
   * Uses tsvector primary, trigram fallback. Suitable for typeahead UI.
   */
  async autocomplete(query: string, maxResults: number = 10): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Primary: full-text search
    let rows = await this.fullTextSearch(trimmed, maxResults, 0);

    // Fallback: trigram for partial/fuzzy
    if (rows.length === 0) {
      rows = await this.trigramSearch(trimmed, maxResults, 0);
    }

    return rows.map((row) => row.description);
  }

  async getFood(fdcId: string): Promise<FoodDetails> {
    const id = parseInt(fdcId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid fdcId: ${fdcId}`);
    }

    // Check cache
    const cached = this.foodCache.get(id);
    if (cached) {
      engineLogger.debug(`[LocalUSDA] Food cache HIT for ID "${fdcId}"`);
      return this.toFoodDetails(cached);
    }

    const row = await this.prisma.usdaFood.findUnique({ where: { fdcId: id } });
    if (!row) {
      throw new Error(`Food ${fdcId} not found in local USDA database`);
    }

    // Cache the food row
    this.foodCache.set(id, row as UsdaFoodRow);

    engineLogger.debug(`[LocalUSDA] getFood HIT for ID "${fdcId}"`);
    return this.toFoodDetails(row as UsdaFoodRow);
  }

  // ------- Private helpers -------

  /**
   * Composite search: combines tsvector ranking + trigram similarity + bonuses
   * into a single scored query. Replaces the old two-stage fallback.
   *
   * Scoring factors:
   *   - ts_rank (tsvector) weighted 2x
   *   - word_similarity (trigram) for fuzzy matching
   *   - Foundation data type bonus (+0.3)
   *   - Exact match bonus (+1.0)
   *   - Prefix match bonus (+0.5) for USDA "X, Y" format
   *   - Shorter description preference (penalty for long descriptions)
   */
  private async compositeSearch(
    query: string,
    maxResults: number,
    offset: number
  ): Promise<UsdaFoodRow[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT "fdcId", "description", "dataType", "nutrients", "portions",
        (
          COALESCE(ts_rank("searchVector", plainto_tsquery('english', $1)), 0) * 2.0
          + COALESCE(word_similarity($1, "description"), 0)
          + CASE WHEN "dataType" = 'Foundation' THEN 0.3 ELSE 0 END
          + CASE WHEN lower("description") = lower($1) THEN 1.0 ELSE 0 END
          + CASE WHEN lower("description") LIKE lower($1) || ',%' THEN 0.5 ELSE 0 END
          - (length("description")::float / 500.0)
        ) AS composite_score
       FROM "UsdaFood"
       WHERE "searchVector" @@ plainto_tsquery('english', $1)
          OR word_similarity($1, "description") > 0.3
       ORDER BY composite_score DESC
       LIMIT $2 OFFSET $3`,
      query,
      maxResults,
      offset
    ) as Promise<UsdaFoodRow[]>;
  }

  /**
   * Full-text search via tsvector (GIN-indexed).
   * Kept for autocomplete which doesn't need composite scoring.
   */
  private async fullTextSearch(
    query: string,
    maxResults: number,
    offset: number
  ): Promise<UsdaFoodRow[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT "fdcId", "description", "dataType", "nutrients", "portions"
       FROM "UsdaFood"
       WHERE "searchVector" @@ plainto_tsquery('english', $1)
       ORDER BY ts_rank("searchVector", plainto_tsquery('english', $1)) DESC
       LIMIT $2 OFFSET $3`,
      query,
      maxResults,
      offset
    ) as Promise<UsdaFoodRow[]>;
  }

  /**
   * Trigram fuzzy search using pg_trgm's word_similarity().
   * Kept for autocomplete which doesn't need composite scoring.
   */
  private async trigramSearch(
    query: string,
    maxResults: number,
    offset: number
  ): Promise<UsdaFoodRow[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT "fdcId", "description", "dataType", "nutrients", "portions"
       FROM (
         SELECT *, word_similarity($1, "description") AS wsim
         FROM "UsdaFood"
       ) sub
       WHERE wsim > 0.3
       ORDER BY wsim DESC, length("description") ASC
       LIMIT $2 OFFSET $3`,
      query,
      maxResults,
      offset
    ) as Promise<UsdaFoodRow[]>;
  }

  private toSearchResult(row: UsdaFoodRow): FoodSearchResult {
    const nutrients = row.nutrients as Record<string, number>;
    const kcal = nutrients[KCAL] || 0;
    const fat = nutrients[FAT] || 0;
    const carbs = nutrients[CARBS] || 0;
    const protein = nutrients[PROTEIN] || 0;

    return {
      foodId: String(row.fdcId),
      name: row.description,
      description: `Per 100g - Calories: ${Math.round(kcal)} | Fat: ${fat.toFixed(1)}g | Carbs: ${carbs.toFixed(1)}g | Protein: ${protein.toFixed(1)}g`,
    };
  }

  private toFoodDetails(row: UsdaFoodRow): FoodDetails {
    const nutrients = row.nutrients as Record<string, number>;
    const portions = row.portions as Array<{ gramWeight: number; description: string }>;

    const servings: FoodServing[] = [];

    // Primary serving: always 100g (matches USDAAdapter behavior)
    servings.push({
      servingId: `usda-${row.fdcId}-100g`,
      servingDescription: '100g',
      metricServingAmount: 100,
      metricServingUnit: 'g',
      calories: nutrients[KCAL] || 0,
      protein: nutrients[PROTEIN] || 0,
      carbohydrate: nutrients[CARBS] || 0,
      fat: nutrients[FAT] || 0,
      fiber: nutrients[FIBER] ?? undefined,
    });

    // Additional servings from portions (scaled from 100g base)
    if (Array.isArray(portions)) {
      for (let i = 0; i < portions.length; i++) {
        const p = portions[i];
        if (!p.gramWeight || p.gramWeight <= 0) continue;

        const scale = p.gramWeight / 100;
        servings.push({
          servingId: `usda-${row.fdcId}-portion-${i}`,
          servingDescription: `${p.description} (${p.gramWeight}g)`,
          metricServingAmount: p.gramWeight,
          metricServingUnit: 'g',
          calories: Math.round((nutrients[KCAL] || 0) * scale),
          protein: Math.round((nutrients[PROTEIN] || 0) * scale * 10) / 10,
          carbohydrate: Math.round((nutrients[CARBS] || 0) * scale * 10) / 10,
          fat: Math.round((nutrients[FAT] || 0) * scale * 10) / 10,
          fiber:
            nutrients[FIBER] !== null && nutrients[FIBER] !== undefined
              ? Math.round(nutrients[FIBER] * scale * 10) / 10
              : undefined,
        });
      }
    }

    return {
      foodId: String(row.fdcId),
      name: row.description,
      servings,
    };
  }
}

// Row shape returned from raw SQL queries
interface UsdaFoodRow {
  fdcId: number;
  description: string;
  dataType: string;
  nutrients: unknown;
  portions: unknown;
}
