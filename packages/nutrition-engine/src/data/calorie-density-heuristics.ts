/**
 * Calorie density heuristics for unresolved ingredients.
 *
 * When all food database sources fail to match an ingredient,
 * this module provides a keyword-based calorie density estimate
 * to prevent 0 kcal entries (which cause severe calorie under-counting).
 *
 * Densities are approximate kcal/g values based on food category.
 */

export interface Per100gEstimate {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface DensityRule {
  keywords: string[];
  kcalPerGram: number;
  /** Approximate macro split: [protein%, carb%, fat%] summing to ~100 */
  macroSplit: [number, number, number];
}

/**
 * Keyword-based density rules, checked in order (first match wins).
 * More specific rules come first.
 */
const DENSITY_RULES: DensityRule[] = [
  // Oils and pure fats (~9 kcal/g)
  {
    keywords: ['oil', 'ghee', 'lard', 'shortening', 'tallow'],
    kcalPerGram: 9.0,
    macroSplit: [0, 0, 100],
  },
  // Butter, cream cheese, mayo (~7 kcal/g)
  {
    keywords: ['butter', 'mayonnaise', 'mayo', 'cream cheese'],
    kcalPerGram: 7.0,
    macroSplit: [1, 1, 98],
  },
  // Nuts and seeds (~6 kcal/g)
  {
    keywords: [
      'nut',
      'nuts',
      'almond',
      'walnut',
      'pecan',
      'cashew',
      'pistachio',
      'peanut butter',
      'almond butter',
      'tahini',
      'seed',
      'seeds',
    ],
    kcalPerGram: 6.0,
    macroSplit: [15, 15, 70],
  },
  // Cheese (~4 kcal/g)
  {
    keywords: ['cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'gouda'],
    kcalPerGram: 3.5,
    macroSplit: [28, 2, 70],
  },
  // Dried grains, flour, pasta (dry) (~3.5 kcal/g)
  {
    keywords: ['flour', 'dry', 'dried', 'granola', 'cereal', 'cracker', 'chip', 'chips'],
    kcalPerGram: 3.5,
    macroSplit: [10, 75, 15],
  },
  // Sweeteners (~3 kcal/g)
  {
    keywords: ['sugar', 'honey', 'syrup', 'molasses', 'agave', 'jaggery'],
    kcalPerGram: 3.0,
    macroSplit: [0, 100, 0],
  },
  // Bread, tortilla, naan (~2.5 kcal/g)
  {
    keywords: ['bread', 'tortilla', 'naan', 'pita', 'bagel', 'muffin', 'roll', 'bun'],
    kcalPerGram: 2.5,
    macroSplit: [12, 75, 13],
  },
  // Protein-dense: meat, poultry, fish (~1.5-2 kcal/g)
  {
    keywords: [
      'chicken',
      'beef',
      'pork',
      'turkey',
      'lamb',
      'steak',
      'salmon',
      'tuna',
      'shrimp',
      'fish',
      'cod',
      'tilapia',
      'duck',
      'venison',
      'bison',
      'protein',
      'tofu',
      'tempeh',
      'seitan',
      'sausage',
      'bacon',
    ],
    kcalPerGram: 1.5,
    macroSplit: [60, 0, 40],
  },
  // Cooked grains, legumes, pasta (cooked) (~1.3 kcal/g)
  {
    keywords: [
      'rice',
      'quinoa',
      'pasta',
      'noodle',
      'couscous',
      'barley',
      'oats',
      'oatmeal',
      'lentil',
      'bean',
      'chickpea',
      'cooked',
      'farro',
      'bulgur',
      'millet',
      'polenta',
      'grits',
    ],
    kcalPerGram: 1.3,
    macroSplit: [15, 75, 10],
  },
  // Eggs, dairy (~1.4 kcal/g)
  {
    keywords: ['egg', 'yogurt', 'milk', 'cream', 'cottage'],
    kcalPerGram: 1.4,
    macroSplit: [35, 15, 50],
  },
  // Starchy vegetables (~0.8 kcal/g)
  {
    keywords: ['potato', 'sweet potato', 'corn', 'squash', 'plantain', 'yam'],
    kcalPerGram: 0.8,
    macroSplit: [8, 85, 7],
  },
  // Fruits (~0.5 kcal/g)
  {
    keywords: [
      'fruit',
      'apple',
      'banana',
      'berry',
      'berries',
      'mango',
      'pineapple',
      'peach',
      'pear',
      'grape',
      'melon',
      'orange',
      'kiwi',
      'papaya',
    ],
    kcalPerGram: 0.5,
    macroSplit: [4, 92, 4],
  },
  // Vegetables, leafy greens (~0.25 kcal/g)
  {
    keywords: [
      'spinach',
      'kale',
      'lettuce',
      'broccoli',
      'cauliflower',
      'celery',
      'cucumber',
      'tomato',
      'onion',
      'pepper',
      'mushroom',
      'zucchini',
      'cabbage',
      'carrot',
      'green',
      'vegetable',
      'salad',
      'arugula',
      'asparagus',
      'eggplant',
      'radish',
    ],
    kcalPerGram: 0.25,
    macroSplit: [25, 60, 15],
  },
  // Sauces, condiments (~1.0 kcal/g)
  {
    keywords: [
      'sauce',
      'paste',
      'dressing',
      'vinegar',
      'ketchup',
      'mustard',
      'salsa',
      'pesto',
      'hummus',
      'guacamole',
    ],
    kcalPerGram: 1.0,
    macroSplit: [10, 50, 40],
  },
  // Herbs, spices (~2.5 kcal/g but tiny amounts, effectively negligible)
  {
    keywords: [
      'spice',
      'herb',
      'basil',
      'cilantro',
      'parsley',
      'oregano',
      'thyme',
      'cumin',
      'paprika',
      'cinnamon',
      'pepper',
      'salt',
      'seasoning',
    ],
    kcalPerGram: 2.5,
    macroSplit: [15, 60, 25],
  },
];

/** Default density when no keyword matches */
const DEFAULT_DENSITY: DensityRule = {
  keywords: [],
  kcalPerGram: 1.0,
  macroSplit: [25, 50, 25],
};

/**
 * Estimate per-100g nutrition for an ingredient name using keyword heuristics.
 * Returns approximate values to prevent 0 kcal entries.
 */
export function estimateCalorieDensity(ingredientName: string): Per100gEstimate {
  const lower = ingredientName.toLowerCase();
  let matched: DensityRule = DEFAULT_DENSITY;

  for (const rule of DENSITY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      matched = rule;
      break;
    }
  }

  const kcalPer100g = matched.kcalPerGram * 100;
  const [protPct, carbPct, fatPct] = matched.macroSplit;

  // Derive grams from percentage using Atwater factors (4/4/9)
  const proteinKcal = kcalPer100g * (protPct / 100);
  const carbsKcal = kcalPer100g * (carbPct / 100);
  const fatKcal = kcalPer100g * (fatPct / 100);

  return {
    kcal: Math.round(kcalPer100g),
    proteinG: Math.round((proteinKcal / 4) * 10) / 10,
    carbsG: Math.round((carbsKcal / 4) * 10) / 10,
    fatG: Math.round((fatKcal / 9) * 10) / 10,
  };
}
