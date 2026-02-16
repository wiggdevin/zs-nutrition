import type { CompiledDay, CompiledMeal, GroceryCategory } from '../../types/schemas';
import { recalcDailyTotals } from './tolerance-checks';

/**
 * Attempt to optimize a day by scaling meals to meet target kcal.
 * Returns the adjusted day and a description of what changed.
 */
export function optimizeDay(
  day: CompiledDay,
  violation: { type: 'kcal' | 'macro'; variancePercent: number }
): { adjustedDay: CompiledDay; description: string } | null {
  if (violation.type !== 'kcal' || day.dailyTotals.kcal === 0) {
    return null;
  }

  const targetKcal = day.targetKcal;
  const currentKcal = day.dailyTotals.kcal;
  const scaleFactor = targetKcal / currentKcal;

  // Only scale if it's a reasonable adjustment (0.8 to 1.2 range)
  if (scaleFactor < 0.8 || scaleFactor > 1.2) {
    return null;
  }

  // Find the meal contributing most to the variance -- scale that one
  const meals = [...day.meals];
  let worstMealIdx = 0;
  let maxKcal = 0;
  for (let i = 0; i < meals.length; i++) {
    if (meals[i].nutrition.kcal > maxKcal) {
      maxKcal = meals[i].nutrition.kcal;
      worstMealIdx = i;
    }
  }

  // Scale the largest meal to bring the day closer to target
  const worstMeal = meals[worstMealIdx];
  const deficitOrExcess = targetKcal - currentKcal;
  const adjustedKcal = worstMeal.nutrition.kcal + deficitOrExcess;

  if (adjustedKcal <= 0) {
    return null;
  }

  const mealScale = adjustedKcal / worstMeal.nutrition.kcal;
  const adjustedMeal: CompiledMeal = {
    ...worstMeal,
    nutrition: {
      kcal: Math.round(worstMeal.nutrition.kcal * mealScale),
      proteinG: Math.round(worstMeal.nutrition.proteinG * mealScale * 10) / 10,
      carbsG: Math.round(worstMeal.nutrition.carbsG * mealScale * 10) / 10,
      fatG: Math.round(worstMeal.nutrition.fatG * mealScale * 10) / 10,
      fiberG: worstMeal.nutrition.fiberG
        ? Math.round(worstMeal.nutrition.fiberG * mealScale * 10) / 10
        : undefined,
    },
  };

  meals[worstMealIdx] = adjustedMeal;

  // Recalculate daily totals
  const newTotals = recalcDailyTotals(meals);
  const newVarianceKcal = newTotals.kcal - targetKcal;
  const newVariancePercent =
    targetKcal > 0 ? Math.round((newVarianceKcal / targetKcal) * 10000) / 100 : 0;

  const adjustedDay: CompiledDay = {
    ...day,
    meals,
    dailyTotals: newTotals,
    varianceKcal: Math.round(newVarianceKcal),
    variancePercent: newVariancePercent,
  };

  const description = `Day ${day.dayNumber}: Scaled "${worstMeal.name}" (${worstMeal.slot}) by ${Math.round((mealScale - 1) * 100)}% to bring kcal from ${currentKcal} → ${newTotals.kcal} (target: ${targetKcal})`;

  return { adjustedDay, description };
}

/**
 * Aggregate all ingredients from all days into categorized grocery list.
 */
export function aggregateGroceryList(days: CompiledDay[]): GroceryCategory[] {
  // Collect all ingredients
  const ingredientMap = new Map<string, { amount: number; unit: string }>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = `${ing.name}|${ing.unit}`;
        const existing = ingredientMap.get(key);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          ingredientMap.set(key, { amount: ing.amount, unit: ing.unit });
        }
      }
    }
  }

  // Categorize ingredients
  const categoryMap = new Map<string, Array<{ name: string; amount: number; unit: string }>>();

  const categoryRules: Array<{ keywords: string[]; category: string }> = [
    {
      keywords: [
        'spinach',
        'broccoli',
        'tomato',
        'pepper',
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

  for (const [key, { amount, unit }] of ingredientMap) {
    const name = key.split('|')[0];
    const nameLower = name.toLowerCase();

    let category = 'Other';
    for (const rule of categoryRules) {
      if (rule.keywords.some((kw) => nameLower.includes(kw))) {
        category = rule.category;
        break;
      }
    }

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push({
      name,
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
