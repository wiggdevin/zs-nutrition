import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchIngredientResolver } from './batch-resolver';
import type { FoodSearchResult, FoodDetails } from '../../adapters/food-data-types';

// ---------------------------------------------------------------------------
// Mock adapters
// ---------------------------------------------------------------------------

function mockLocalUsdaAdapter() {
  return {
    searchFoods: vi.fn<(query: string, max: number) => Promise<FoodSearchResult[]>>(),
    getFood: vi.fn<(id: string) => Promise<FoodDetails>>(),
  };
}

function mockUsdaAdapter() {
  return {
    searchFoods: vi.fn<(query: string, max: number) => Promise<FoodSearchResult[]>>(),
    getFood: vi.fn<(id: string) => Promise<FoodDetails>>(),
  };
}

function mockFatSecretAdapter() {
  return {
    searchFoods: vi.fn<(query: string, max: number) => Promise<FoodSearchResult[]>>(),
    getFood: vi.fn<(id: string) => Promise<FoodDetails>>(),
  };
}

function mockFoodAliasCache() {
  return {
    get: vi.fn(),
    isLoaded: true,
    size: 0,
    load: vi.fn(),
  };
}

function makeFoodDetails(
  fdcId: number,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number
): FoodDetails {
  return {
    foodId: String(fdcId),
    name,
    servings: [
      {
        servingId: '1',
        servingDescription: 'per 100g',
        metricServingAmount: 100,
        metricServingUnit: 'g',
        calories: kcal,
        protein,
        carbohydrate: carbs,
        fat,
      },
    ],
  };
}

describe('BatchIngredientResolver', () => {
  let localUsda: ReturnType<typeof mockLocalUsdaAdapter>;
  let usda: ReturnType<typeof mockUsdaAdapter>;
  let fatSecret: ReturnType<typeof mockFatSecretAdapter>;
  let aliasCache: ReturnType<typeof mockFoodAliasCache>;

  beforeEach(() => {
    localUsda = mockLocalUsdaAdapter();
    usda = mockUsdaAdapter();
    fatSecret = mockFatSecretAdapter();
    aliasCache = mockFoodAliasCache();
    vi.clearAllMocks();
  });

  it('returns empty array for empty input', async () => {
    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      fatSecret as never,
      aliasCache as never
    );
    const result = await resolver.resolve([]);
    expect(result).toEqual([]);
  });

  it('resolves ingredient via LocalUSDA search', async () => {
    const chickenDetails = makeFoodDetails(
      171077,
      'Chicken, breast, boneless, skinless',
      165,
      31,
      0,
      3.6
    );
    localUsda.searchFoods.mockResolvedValue([
      { foodId: '171077', name: 'Chicken breast', description: '' },
    ]);
    localUsda.getFood.mockResolvedValue(chickenDetails);
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([{ name: 'chicken breast' }]);

    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(true);
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0].fdcId).toBe(171077);
    expect(result[0].matches[0].source).toBe('local-usda');
    expect(result[0].matches[0].per100g.kcal).toBe(165);
  });

  it('deduplicates ingredients by normalized name', async () => {
    const chickenDetails = makeFoodDetails(171077, 'Chicken breast', 165, 31, 0, 3.6);
    localUsda.searchFoods.mockResolvedValue([
      { foodId: '171077', name: 'Chicken breast', description: '' },
    ]);
    localUsda.getFood.mockResolvedValue(chickenDetails);
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([
      { name: 'Chicken Breast' },
      { name: 'chicken breast' },
      { name: 'CHICKEN BREAST' },
    ]);

    expect(result).toHaveLength(3);
    // All should be resolved (same data)
    expect(result.every((r) => r.resolved)).toBe(true);
    // But LocalUSDA should only be called once due to dedup
    expect(localUsda.searchFoods).toHaveBeenCalledTimes(1);
  });

  it('falls through to USDA API when LocalUSDA has no results', async () => {
    localUsda.searchFoods.mockResolvedValue([]);
    const riceDetails = makeFoodDetails(169756, 'Rice, brown, cooked', 123, 2.7, 25.6, 1);
    usda.searchFoods.mockResolvedValue([{ foodId: '169756', name: 'Brown rice', description: '' }]);
    usda.getFood.mockResolvedValue(riceDetails);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([{ name: 'brown rice cooked' }]);

    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(true);
    expect(result[0].matches[0].source).toBe('usda-api');
  });

  it('falls through to FatSecret when USDA sources return empty', async () => {
    localUsda.searchFoods.mockResolvedValue([]);
    usda.searchFoods.mockResolvedValue([]);

    const yogurtDetails = makeFoodDetails(999, 'Greek Yogurt, Plain', 59, 10, 3.6, 0.4);
    fatSecret.searchFoods.mockResolvedValue([
      { foodId: 'fs-123', name: 'Greek Yogurt', description: '', brandName: undefined },
    ]);
    fatSecret.getFood.mockResolvedValue(yogurtDetails);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      fatSecret as never,
      undefined
    );

    const result = await resolver.resolve([{ name: 'greek yogurt' }]);

    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(true);
    expect(result[0].matches[0].source).toBe('fatsecret');
  });

  it('handles partial failure gracefully', async () => {
    const chickenDetails = makeFoodDetails(171077, 'Chicken breast', 165, 31, 0, 3.6);
    localUsda.searchFoods
      .mockResolvedValueOnce([{ foodId: '171077', name: 'Chicken breast', description: '' }])
      .mockRejectedValueOnce(new Error('DB connection lost'));
    localUsda.getFood.mockResolvedValue(chickenDetails);
    usda.searchFoods.mockRejectedValue(new Error('API down'));

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([
      { name: 'chicken breast' },
      { name: 'mysterious ingredient' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].resolved).toBe(true);
    expect(result[1].resolved).toBe(false);
    expect(result[1].matches).toHaveLength(0);
  });

  it('resolves via alias cache when fdcId is present', async () => {
    aliasCache.get.mockReturnValue({ canonicalName: 'Olive Oil, Extra Virgin', fdcId: 789012 });
    const oilDetails = makeFoodDetails(789012, 'Olive Oil, Extra Virgin', 884, 0, 0, 100);
    localUsda.getFood.mockResolvedValue(oilDetails);
    localUsda.searchFoods.mockResolvedValue([]);
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      aliasCache as never
    );

    const result = await resolver.resolve([{ name: 'olive oil' }]);

    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(true);
    expect(result[0].matches[0].source).toBe('alias');
    expect(result[0].matches[0].fdcId).toBe(789012);
    expect(result[0].matches[0].per100g.kcal).toBe(884);
  });

  it('caps at 60 ingredients', async () => {
    localUsda.searchFoods.mockResolvedValue([]);
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const manyIngredients = Array.from({ length: 80 }, (_, i) => ({ name: `ingredient-${i}` }));
    const result = await resolver.resolve(manyIngredients);

    // Should be capped at 60
    expect(result).toHaveLength(60);
  });

  it('returns max 3 matches per ingredient', async () => {
    // Set up LocalUSDA to return 5 results
    localUsda.searchFoods.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        foodId: String(1000 + i),
        name: `Rice variant ${i}`,
        description: '',
      }))
    );
    localUsda.getFood.mockImplementation(async (id: string) =>
      makeFoodDetails(Number(id), `Rice variant ${Number(id) - 1000}`, 130, 2.7, 28, 0.3)
    );
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([{ name: 'rice' }]);

    expect(result).toHaveLength(1);
    expect(result[0].matches.length).toBeLessThanOrEqual(3);
  });

  it('preserves original ingredient names', async () => {
    localUsda.searchFoods.mockResolvedValue([]);
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(
      localUsda as never,
      usda as never,
      undefined,
      undefined
    );

    const result = await resolver.resolve([{ name: 'Chicken Breast, Boneless, Skinless' }]);

    expect(result[0].name).toBe('Chicken Breast, Boneless, Skinless');
  });

  it('works with no adapters except USDA', async () => {
    usda.searchFoods.mockResolvedValue([]);

    const resolver = new BatchIngredientResolver(undefined, usda as never, undefined, undefined);

    const result = await resolver.resolve([{ name: 'test ingredient' }]);
    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(false);
  });
});
