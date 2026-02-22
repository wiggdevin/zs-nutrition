/**
 * FoodAliasCache — In-memory cache of FoodAlias table for O(1) ingredient name lookups.
 *
 * Replaces the hardcoded INGREDIENT_NAME_MAP with a data-driven approach.
 * Loads the entire FoodAlias table (~124 entries, negligible memory) on first access.
 * When an alias has a direct fdcId, the caller can skip search entirely.
 */

import type { PrismaClient } from '@prisma/client';
import { engineLogger } from '../utils/logger';

export interface AliasEntry {
  canonicalName: string;
  fdcId?: number;
}

export class FoodAliasCache {
  private cache: Map<string, AliasEntry> | null = null;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Lazy-load the entire FoodAlias table into memory.
   * Safe to call multiple times — only loads once.
   */
  async load(): Promise<void> {
    if (this.cache) return;

    const rows = await this.prisma.foodAlias.findMany({
      select: { alias: true, canonicalName: true, usdaFdcId: true },
    });

    this.cache = new Map();
    for (const row of rows) {
      this.cache.set(row.alias.toLowerCase(), {
        canonicalName: row.canonicalName,
        fdcId: row.usdaFdcId ?? undefined,
      });
    }

    engineLogger.info(`[FoodAliasCache] Loaded ${this.cache.size} aliases`);
  }

  /**
   * Look up an alias. Returns undefined if no alias exists.
   * Must call load() before first use.
   */
  get(alias: string): AliasEntry | undefined {
    return this.cache?.get(alias.toLowerCase().trim());
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
