/**
 * LocalUSDAAdapter — Sub-millisecond food lookups against the local UsdaFood table.
 *
 * Uses PostgreSQL full-text search (tsvector + GIN index) for fast ingredient matching.
 * Falls back to pg_trgm trigram search when tsvector returns zero results
 * (handles partial words, abbreviations, typos like "broc" → "Broccoli").
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

export class LocalUSDAAdapter {
  constructor(private prisma: PrismaClient) {}

  async searchFoods(
    query: string,
    maxResults: number = 20,
    page: number = 0
  ): Promise<FoodSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const offset = page * maxResults;

    // Primary: full-text search via tsvector (GIN-indexed)
    let rows = await this.fullTextSearch(trimmed, maxResults, offset);

    // Fallback: trigram search if tsvector returns nothing (handles partial words, typos)
    if (rows.length === 0) {
      rows = await this.trigramSearch(trimmed, maxResults, offset);
    }

    if (rows.length > 0) {
      engineLogger.debug(
        `[LocalUSDA] Search HIT for "${trimmed}" (${rows.length} results, page ${page})`
      );
    } else {
      engineLogger.debug(`[LocalUSDA] Search MISS for "${trimmed}"`);
    }

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

    const row = await this.prisma.usdaFood.findUnique({ where: { fdcId: id } });
    if (!row) {
      throw new Error(`Food ${fdcId} not found in local USDA database`);
    }

    engineLogger.debug(`[LocalUSDA] getFood HIT for ID "${fdcId}"`);
    return this.toFoodDetails(row);
  }

  // ------- Private helpers -------

  private async fullTextSearch(
    query: string,
    maxResults: number,
    offset: number
  ): Promise<UsdaFoodRow[]> {
    // plainto_tsquery handles natural language input without requiring boolean operators
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
   * word_similarity is better than similarity for short query fragments
   * against long descriptions (e.g. "broc" matches "Broccoli, raw").
   * Threshold 0.3 balances recall vs precision.
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
