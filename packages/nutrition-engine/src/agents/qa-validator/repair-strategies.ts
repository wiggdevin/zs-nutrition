import type { CompiledDay, GroceryCategory } from '../../types/schemas';
import type { Violation } from './tolerance-checks';
import { proportionalScaling } from './strategies/proportional-scaling';

/**
 * Backward-compatible wrapper that delegates to the proportional-scaling strategy.
 * @deprecated Use the strategy cascade in QAValidator instead.
 */
export function optimizeDay(
  day: CompiledDay,
  violation: Violation
): { adjustedDay: CompiledDay; description: string } | null {
  return proportionalScaling.attempt(day, violation);
}

/**
 * Aggregate all ingredients from all days into categorized grocery list.
 *
 * Fixes applied:
 * - Case-insensitive dedup: keys use lowercased name + unit to merge "Chicken Breast" with "chicken breast"
 * - Filter "to taste" items: ingredients with unit "to taste" or amount 0 are excluded
 * - Full-word category matching: prevents "bell pepper" from matching the pantry keyword "pepper"
 */
export function aggregateGroceryList(days: CompiledDay[]): GroceryCategory[] {
  // Collect all ingredients with case-insensitive dedup key
  const ingredientMap = new Map<string, { displayName: string; amount: number; unit: string }>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        // Filter out "to taste" items and zero-amount items
        if (ing.unit.toLowerCase().trim() === 'to taste' || ing.amount === 0) {
          continue;
        }

        // Case-insensitive dedup key: lowercased name + lowercased unit
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
        const existing = ingredientMap.get(key);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          // Preserve the first-seen display name (original casing)
          ingredientMap.set(key, { displayName: ing.name, amount: ing.amount, unit: ing.unit });
        }
      }
    }
  }

  // Categorize ingredients
  const categoryMap = new Map<string, Array<{ name: string; amount: number; unit: string }>>();

  // Category rules using full-word matching to prevent substring false positives.
  // Multi-word keywords (e.g. "sweet potato", "olive oil", "garlic powder") are
  // checked via includes() since they are specific enough to avoid ambiguity.
  // Single-word keywords use word-boundary regex to prevent matches like
  // "bell pepper" hitting the pantry keyword "pepper".
  const categoryRules: Array<{ keywords: string[]; category: string }> = [
    {
      keywords: [
        'spinach',
        'broccoli',
        'tomato',
        'bell pepper',
        'lettuce',
        'salad',
        'carrot',
        'onion',
        'garlic',
        'potato',
        'corn',
        'zucchini',
        'mushroom',
        'asparagus',
        'vegetable',
        'greens',
        'avocado',
        'sweet potato',
        'cucumber',
        'banana',
        'berr',
        'mango',
        'apple',
        'orange',
        'fruit',
        'lemon',
        'lime',
        'jalapeno',
        'poblano',
        'habanero',
        'serrano',
        'celery',
        'kale',
        'cabbage',
        'cauliflower',
        'eggplant',
        'beet',
        'radish',
        'squash',
        'pumpkin',
        'pear',
        'peach',
        'plum',
        'grape',
        'melon',
        'pineapple',
        'ginger root',
      ],
      category: 'Produce',
    },
    {
      keywords: [
        'chicken',
        'beef',
        'pork',
        'turkey',
        'salmon',
        'tuna',
        'cod',
        'shrimp',
        'fish',
        'steak',
        'lamb',
      ],
      category: 'Meat and Seafood',
    },
    {
      keywords: ['egg', 'yogurt', 'cheese', 'milk', 'cream', 'butter'],
      category: 'Dairy and Eggs',
    },
    { keywords: ['bread', 'bagel', 'pancake', 'tortilla'], category: 'Bakery' },
    {
      keywords: [
        'rice',
        'pasta',
        'oats',
        'quinoa',
        'flour',
        'cereal',
        'bean',
        'lentil',
        'chickpea',
        'tofu',
        'tempeh',
        'edamame',
        'olive oil',
        'oil',
        'vinegar',
        'soy sauce',
        'honey',
        'maple',
        'sauce',
        'dressing',
        'salt',
        'pepper',
        'spice',
        'herb',
        'cumin',
        'paprika',
        'garlic powder',
        'season',
        'taste',
        'almond',
        'walnut',
        'peanut',
        'seed',
        'nut',
        'cashew',
      ],
      category: 'Pantry',
    },
    { keywords: ['frozen'], category: 'Frozen' },
  ];

  for (const [, { displayName, amount, unit }] of ingredientMap) {
    const nameLower = displayName.toLowerCase().trim();

    let category = 'Other';
    for (const rule of categoryRules) {
      if (rule.keywords.some((kw) => matchesKeyword(nameLower, kw))) {
        category = rule.category;
        break;
      }
    }

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push({
      name: displayName,
      amount: roundUpForShopping(amount, unit),
      unit,
    });
  }

  // Convert to GroceryCategory array, sorted by specified store section order
  const categoryOrder = [
    'Produce',
    'Meat and Seafood',
    'Dairy and Eggs',
    'Bakery',
    'Pantry',
    'Frozen',
    'Other',
  ];

  return Array.from(categoryMap.entries())
    .sort(([a], [b]) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) {
        return -1;
      }
      if (indexB !== -1) {
        return 1;
      }
      return a.localeCompare(b);
    })
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Match an ingredient name against a keyword using full-word boundaries.
 *
 * Multi-word keywords (e.g. "bell pepper", "sweet potato") use substring matching
 * since they are specific enough to be unambiguous. Single-word keywords use
 * word-boundary regex to prevent false positives like "bell pepper" matching
 * the standalone keyword "pepper" in a different category.
 */
function matchesKeyword(nameLower: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    // Multi-word keywords: substring match is safe and expected
    return nameLower.includes(keyword);
  }
  // Single-word keywords: use word-boundary regex
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}`);
  return pattern.test(nameLower);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Round amounts UP for practical shopping.
 * - Weight units (g, kg, oz, lbs): round up to nearest practical increment
 * - Volume units (ml, l, cups, tbsp, tsp): round up to nearest practical increment
 * - Count/pieces: round up to whole number
 * - Small amounts (< 1): round up to nearest 0.25 or 0.5
 */
export function roundUpForShopping(amount: number, unit: string): number {
  const unitLower = unit.toLowerCase().trim();

  // Grams: round up to nearest 25g for amounts > 100g, nearest 10g for smaller
  if (unitLower === 'g' || unitLower === 'grams' || unitLower === 'gram') {
    if (amount > 500) {
      return Math.ceil(amount / 50) * 50;
    }
    if (amount > 100) {
      return Math.ceil(amount / 25) * 25;
    }
    return Math.ceil(amount / 10) * 10;
  }

  // Kilograms: round up to nearest 0.25 kg
  if (unitLower === 'kg' || unitLower === 'kilograms' || unitLower === 'kilogram') {
    return Math.ceil(amount * 4) / 4;
  }

  // Ounces: round up to whole ounces
  if (unitLower === 'oz' || unitLower === 'ounces' || unitLower === 'ounce') {
    return Math.ceil(amount);
  }

  // Pounds: round up to nearest 0.5 lb
  if (
    unitLower === 'lb' ||
    unitLower === 'lbs' ||
    unitLower === 'pounds' ||
    unitLower === 'pound'
  ) {
    return Math.ceil(amount * 2) / 2;
  }

  // Milliliters: round up to nearest 25ml or 50ml
  if (unitLower === 'ml' || unitLower === 'milliliters' || unitLower === 'milliliter') {
    if (amount > 200) {
      return Math.ceil(amount / 50) * 50;
    }
    return Math.ceil(amount / 25) * 25;
  }

  // Liters: round up to nearest 0.25
  if (unitLower === 'l' || unitLower === 'liters' || unitLower === 'liter') {
    return Math.ceil(amount * 4) / 4;
  }

  // Cups: round up to nearest 0.25 cup
  if (unitLower === 'cup' || unitLower === 'cups') {
    return Math.ceil(amount * 4) / 4;
  }

  // Tablespoons: round up to whole tbsp
  if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') {
    return Math.ceil(amount);
  }

  // Teaspoons: round up to nearest 0.5 tsp
  if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
    return Math.ceil(amount * 2) / 2;
  }

  // Scoops, slices, pieces, etc: round up to whole numbers
  if (
    ['scoop', 'scoops', 'slice', 'slices', 'piece', 'pieces', 'whole', 'clove', 'cloves'].includes(
      unitLower
    )
  ) {
    return Math.ceil(amount);
  }

  // Default: round up to nearest 0.5
  if (amount < 1) {
    return Math.ceil(amount * 4) / 4; // nearest 0.25
  }
  return Math.ceil(amount * 2) / 2; // nearest 0.5
}
