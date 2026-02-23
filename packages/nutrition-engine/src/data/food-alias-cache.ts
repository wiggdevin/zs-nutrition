/**
 * FoodAliasCache — In-memory cache of FoodAlias table for O(1) ingredient name lookups.
 *
 * Replaces the hardcoded INGREDIENT_NAME_MAP with a data-driven approach.
 * Loads the entire FoodAlias table on first access.
 * When an alias has a direct fdcId, the caller can skip search entirely.
 *
 * Enhanced with fuzzy matching:
 *   1. Exact match (O(1))
 *   2. Token-set match (handles word reordering)
 *   3. Progressive prefix match ("chicken breast skinless" → "chicken breast" → "chicken")
 *   4. Common prefix stripping (fresh, dried, frozen, organic, etc.)
 */

import type { PrismaClient } from '@prisma/client';
import { engineLogger } from '../utils/logger';

export interface AliasEntry {
  canonicalName: string;
  fdcId?: number;
  per100g?: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

/** Common prefixes to strip when fuzzy matching */
const STRIPPABLE_PREFIXES = [
  'fresh',
  'dried',
  'frozen',
  'organic',
  'chopped',
  'minced',
  'sliced',
  'diced',
  'shredded',
  'grated',
  'ground',
  'crushed',
  'whole',
  'raw',
  'cooked',
  'roasted',
  'grilled',
  'baked',
  'steamed',
  'boiled',
  'fried',
  'smoked',
  'canned',
  'pickled',
  'toasted',
  'blanched',
];

/**
 * Create a token-set key by sorting tokens alphabetically.
 * "chicken breast skinless" -> "breast chicken skinless"
 */
function tokenSetKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .sort()
    .join(' ');
}

export class FoodAliasCache {
  private cache: Map<string, AliasEntry> | null = null;
  /** Token-set map for word-reorder matching */
  private tokenSetMap: Map<string, AliasEntry> | null = null;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Lazy-load the entire FoodAlias table into memory.
   * Safe to call multiple times -- only loads once.
   * Builds both exact-match and token-set maps.
   */
  async load(): Promise<void> {
    if (this.cache) return;

    const rows = await this.prisma.foodAlias.findMany({
      select: {
        alias: true,
        canonicalName: true,
        usdaFdcId: true,
        priority: true,
        per100gKcal: true,
        per100gProtein: true,
        per100gCarbs: true,
        per100gFat: true,
      },
      orderBy: { priority: 'desc' }, // Higher priority first
    });

    this.cache = new Map();
    this.tokenSetMap = new Map();

    for (const row of rows) {
      const entry: AliasEntry = {
        canonicalName: row.canonicalName,
        fdcId: row.usdaFdcId ?? undefined,
      };

      // Include pre-computed per100g nutrition if all four fields are present
      if (
        row.per100gKcal !== null &&
        row.per100gProtein !== null &&
        row.per100gCarbs !== null &&
        row.per100gFat !== null
      ) {
        entry.per100g = {
          kcal: row.per100gKcal,
          proteinG: row.per100gProtein,
          carbsG: row.per100gCarbs,
          fatG: row.per100gFat,
        };
      }

      const key = row.alias.toLowerCase();

      // Exact match: higher priority wins (sorted desc, so first-seen wins)
      if (!this.cache.has(key)) {
        this.cache.set(key, entry);
      }

      // Token-set map: same priority logic
      const tsKey = tokenSetKey(row.alias);
      if (!this.tokenSetMap.has(tsKey)) {
        this.tokenSetMap.set(tsKey, entry);
      }
    }

    engineLogger.info(
      `[FoodAliasCache] Loaded ${this.cache.size} aliases, ${this.tokenSetMap.size} token-set entries`
    );
  }

  /**
   * Look up an alias with fuzzy matching fallback.
   * Tries in order:
   *   1. Exact match
   *   2. Token-set match (word reordering)
   *   3. Stripped-prefix match (remove fresh/dried/frozen/etc.)
   *   4. Progressive prefix match (drop trailing words)
   *   5. Singular form (strip trailing "s")
   *
   * Must call load() before first use.
   */
  get(alias: string): AliasEntry | undefined {
    const normalized = alias.toLowerCase().trim();

    // 1. Exact match
    const exact = this.cache?.get(normalized);
    if (exact) return exact;

    // 2. Token-set match (handles word reordering)
    if (this.tokenSetMap) {
      const tsKey = tokenSetKey(normalized);
      const tokenMatch = this.tokenSetMap.get(tsKey);
      if (tokenMatch) return tokenMatch;
    }

    // 3. Strip common prefixes and try again
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    if (words.length >= 2) {
      const stripped = words.filter((w) => !STRIPPABLE_PREFIXES.includes(w));
      if (stripped.length > 0 && stripped.length < words.length) {
        const strippedKey = stripped.join(' ');
        const strippedMatch = this.cache?.get(strippedKey);
        if (strippedMatch) return strippedMatch;

        // Also try token-set of stripped
        if (this.tokenSetMap) {
          const strippedTsKey = tokenSetKey(strippedKey);
          const strippedTsMatch = this.tokenSetMap.get(strippedTsKey);
          if (strippedTsMatch) return strippedTsMatch;
        }
      }
    }

    // 4. Progressive prefix: drop trailing words one at a time
    // "chicken breast skinless boneless" -> "chicken breast skinless" -> "chicken breast" -> "chicken"
    if (words.length >= 2) {
      for (let len = words.length - 1; len >= 1; len--) {
        const prefix = words.slice(0, len).join(' ');
        const prefixMatch = this.cache?.get(prefix);
        if (prefixMatch) return prefixMatch;
      }
    }

    // 5. Singular form: strip trailing "s" from last word
    if (words.length > 0) {
      const lastWord = words[words.length - 1];
      if (lastWord.length >= 4 && lastWord.endsWith('s') && !lastWord.endsWith('ss')) {
        const singular = [...words.slice(0, -1), lastWord.slice(0, -1)].join(' ');
        const singularMatch = this.cache?.get(singular);
        if (singularMatch) return singularMatch;
      }
    }

    return undefined;
  }

  /** Number of loaded aliases. */
  get size(): number {
    return this.cache?.size ?? 0;
  }

  /** Whether the cache has been loaded. */
  get isLoaded(): boolean {
    return this.cache !== null;
  }
}
