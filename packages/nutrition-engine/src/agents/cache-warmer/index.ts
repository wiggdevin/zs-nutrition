import { engineLogger } from '../../utils/logger';

/**
 * Universal foods to pre-cache, filtered by dietary preferences.
 * These represent the most commonly used ingredients across meal plans,
 * ensuring cache hits for the majority of pipeline runs.
 */
const UNIVERSAL_FOODS = [
  'chicken breast',
  'salmon fillet',
  'ground turkey',
  'eggs',
  'brown rice',
  'quinoa',
  'sweet potato',
  'oats',
  'broccoli',
  'spinach',
  'bell pepper',
  'avocado',
  'greek yogurt',
  'cottage cheese',
  'almonds',
  'olive oil',
  'banana',
  'blueberries',
  'lentils',
  'tofu',
] as const;

/** Dietary-style-specific ingredients for better cache hit rates */
const STYLE_FOODS: Record<string, readonly string[]> = {
  omnivore: ['ground beef', 'pork tenderloin', 'cheddar cheese', 'whole wheat bread'],
  vegan: ['tempeh', 'nutritional yeast', 'hemp seeds', 'cashews', 'coconut milk'],
  keto: ['cream cheese', 'butter', 'coconut oil', 'cauliflower', 'heavy cream'],
  pescatarian: ['tuna', 'shrimp', 'cod', 'sardines'],
};

const MEAT_ITEMS = new Set(['chicken breast', 'salmon fillet', 'ground turkey']);
const DAIRY_ITEMS = new Set(['greek yogurt', 'cottage cheese']);
const ANIMAL_ITEMS = new Set([...MEAT_ITEMS, ...DAIRY_ITEMS, 'eggs']);

interface CacheWarmerOptions {
  /** Abort signal to cancel warming early (e.g., when Claude response arrives). */
  signal?: AbortSignal;
  /** Max concurrent search requests. Defaults to 3 to avoid rate-limiting. */
  concurrency?: number;
}

interface CacheWarmerResult {
  warmed: number;
  skipped: number;
  errors: number;
}

/**
 * Pre-populates food data cache during Claude API wait time.
 *
 * The nutrition pipeline spends 30-60s waiting for Claude to generate
 * recipes. During that idle window, CacheWarmer fires off USDA
 * searches for common foods so they are already cached when Agent 4
 * (Nutrition Compiler) needs them.
 *
 * Usage is fire-and-forget: errors are counted but never thrown,
 * and an AbortSignal allows the caller to cancel early.
 */
export class CacheWarmer {
  /**
   * Warm the cache with common foods filtered by dietary restrictions.
   *
   * @param dietaryStyle - e.g. 'omnivore', 'vegetarian', 'vegan', 'pescatarian'
   * @param allergies - list of allergy strings (e.g. ['dairy', 'nuts'])
   * @param searchFn - the food data search function (injected for testability)
   * @param options - concurrency and abort signal
   */
  async warm(
    dietaryStyle: string,
    allergies: string[],
    searchFn: (query: string) => Promise<unknown>,
    options: CacheWarmerOptions = {}
  ): Promise<CacheWarmerResult> {
    const { signal, concurrency = 3 } = options;
    const allergySet = new Set(allergies.map((a) => a.toLowerCase()));

    // Filter universal foods based on dietary restrictions
    const filteredUniversal = UNIVERSAL_FOODS.filter((food) => {
      if (dietaryStyle === 'vegan' && ANIMAL_ITEMS.has(food)) return false;
      if (dietaryStyle === 'vegetarian' && MEAT_ITEMS.has(food)) return false;
      if (dietaryStyle === 'pescatarian' && MEAT_ITEMS.has(food) && food !== 'salmon fillet')
        return false;
      for (const allergy of allergySet) {
        if (food.toLowerCase().includes(allergy)) return false;
      }
      return true;
    });

    // Add style-specific foods, filtering by allergies
    const styleFoods = (STYLE_FOODS[dietaryStyle] || []).filter((food) => {
      for (const allergy of allergySet) {
        if (food.toLowerCase().includes(allergy)) return false;
      }
      return true;
    });

    const foods = [...filteredUniversal, ...styleFoods];

    let warmed = 0;
    let errors = 0;

    // Process in chunks to respect concurrency limit
    const chunks: string[][] = [];
    for (let i = 0; i < foods.length; i += concurrency) {
      chunks.push(foods.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      if (signal?.aborted) break;

      const results = await Promise.allSettled(chunk.map((food) => searchFn(food)));

      for (const result of results) {
        if (result.status === 'fulfilled') warmed++;
        else errors++;
      }
    }

    const totalAvailable = UNIVERSAL_FOODS.length + (STYLE_FOODS[dietaryStyle]?.length || 0);
    const skipped = totalAvailable - foods.length;
    engineLogger.info(`[CacheWarmer] Warmed ${warmed}, skipped ${skipped}, errors ${errors}`);

    return { warmed, skipped, errors };
  }
}
