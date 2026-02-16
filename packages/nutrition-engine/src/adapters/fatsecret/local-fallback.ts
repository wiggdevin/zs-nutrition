/**
 * Local food and recipe databases for development/fallback.
 * Used when FatSecret credentials are unavailable.
 * Search and lookup logic over the static data in local-data.ts.
 */

import type { FoodSearchResult, FoodDetails, RecipeSearchResult } from './types';
import { LOCAL_FOODS, LOCAL_RECIPES } from './local-data';

export class LocalFoodDatabase {
  static searchFoods(
    query: string,
    maxResults: number = 20,
    pageNumber: number = 0
  ): FoodSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }

    const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);

    const scored = LOCAL_FOODS.map((f) => {
      const nameLower = f.name.toLowerCase();
      if (nameLower.includes(q)) {
        return { food: f, score: 100 };
      }
      const matchCount = queryWords.filter((w) => nameLower.includes(w)).length;
      return { food: f, score: matchCount };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const offset = pageNumber * maxResults;
    const paginated = scored.slice(offset, offset + maxResults);

    return paginated.map((item) => ({
      foodId: item.food.foodId,
      name: item.food.name,
      description: item.food.description,
      brandName: item.food.brandName,
    }));
  }

  static getFood(foodId: string): FoodDetails {
    const food = LOCAL_FOODS.find((f) => f.foodId === foodId);
    if (!food) {
      throw new Error(`Food ${foodId} not found in local database`);
    }
    return {
      foodId: food.foodId,
      name: food.name,
      brandName: food.brandName,
      servings: food.servings,
    };
  }

  static autocomplete(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) {
      return [];
    }

    const matches = LOCAL_FOODS.filter((f) => f.name.toLowerCase().includes(q))
      .map((f) => f.name)
      .slice(0, 8);

    return matches;
  }
}

export class LocalRecipeDatabase {
  static searchRecipes(query: string, maxResults: number = 10): RecipeSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }

    const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);

    const scored = LOCAL_RECIPES.map((r) => {
      const nameLower = r.name.toLowerCase();
      const descLower = r.description.toLowerCase();
      if (nameLower.includes(q)) {
        return { recipe: r, score: 100 };
      }
      const nameMatches = queryWords.filter((w) => nameLower.includes(w)).length;
      const descMatches = queryWords.filter((w) => descLower.includes(w)).length;
      return { recipe: r, score: nameMatches * 2 + descMatches };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored.map((item) => item.recipe);
  }
}
