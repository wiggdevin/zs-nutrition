/**
 * Convert a quantity + unit to grams for per-100g scaling.
 * Shared utility used by NutritionCompiler and draft-macro-corrector.
 *
 * When foodName is provided, uses food-specific density maps for more
 * accurate cup and piece conversions (e.g., 1 cup spinach = 30g, not 240g).
 */

/** Grams per cup for common foods (keyword → grams) */
const GRAMS_PER_CUP: { keywords: string[]; grams: number }[] = [
  { keywords: ['spinach', 'kale', 'arugula', 'lettuce', 'mixed greens', 'salad'], grams: 30 },
  { keywords: ['broccoli', 'cauliflower', 'broccoli florets'], grams: 90 },
  { keywords: ['rice', 'quinoa', 'couscous', 'bulgur', 'farro', 'grits', 'polenta'], grams: 185 },
  { keywords: ['oats', 'oatmeal', 'rolled oats', 'granola'], grams: 80 },
  { keywords: ['flour', 'almond flour', 'coconut flour'], grams: 120 },
  { keywords: ['sugar', 'brown sugar', 'coconut sugar'], grams: 200 },
  { keywords: ['milk', 'buttermilk', 'kefir', 'oat milk', 'almond milk', 'soy milk'], grams: 245 },
  { keywords: ['yogurt', 'greek yogurt', 'sour cream', 'cottage cheese'], grams: 245 },
  { keywords: ['cream', 'heavy cream', 'half and half'], grams: 240 },
  {
    keywords: ['berries', 'blueberries', 'strawberries', 'raspberries', 'blackberries'],
    grams: 150,
  },
  { keywords: ['cherry', 'cherries', 'grapes'], grams: 150 },
  { keywords: ['bean', 'beans', 'chickpea', 'chickpeas', 'lentil', 'lentils'], grams: 180 },
  { keywords: ['corn', 'peas', 'green peas'], grams: 160 },
  { keywords: ['mushroom', 'mushrooms'], grams: 70 },
  { keywords: ['tomato', 'diced tomatoes', 'crushed tomatoes'], grams: 180 },
  { keywords: ['carrot', 'carrots'], grams: 130 },
  { keywords: ['bell pepper', 'pepper'], grams: 150 },
  { keywords: ['onion', 'onions'], grams: 160 },
  { keywords: ['celery'], grams: 100 },
  { keywords: ['cucumber'], grams: 130 },
  { keywords: ['cabbage'], grams: 90 },
  { keywords: ['nut', 'nuts', 'almonds', 'walnuts', 'cashews', 'pecans', 'peanuts'], grams: 140 },
  { keywords: ['coconut', 'shredded coconut'], grams: 80 },
  { keywords: ['honey', 'maple syrup', 'agave', 'molasses'], grams: 340 },
  { keywords: ['peanut butter', 'almond butter', 'tahini'], grams: 260 },
  { keywords: ['oil', 'olive oil'], grams: 220 },
  { keywords: ['broth', 'stock', 'water'], grams: 240 },
  { keywords: ['pasta', 'noodle', 'spaghetti', 'penne', 'macaroni'], grams: 140 },
  { keywords: ['mango', 'pineapple', 'papaya'], grams: 165 },
  { keywords: ['apple', 'peach', 'pear'], grams: 125 },
  { keywords: ['avocado'], grams: 150 },
  { keywords: ['hummus', 'guacamole', 'salsa'], grams: 245 },
  { keywords: ['cheese', 'shredded cheese', 'grated cheese'], grams: 115 },
];

/** Grams per piece/count for common foods (keyword → grams) */
const GRAMS_PER_PIECE: { keywords: string[]; grams: number }[] = [
  { keywords: ['egg', 'eggs'], grams: 50 },
  { keywords: ['banana'], grams: 118 },
  { keywords: ['apple'], grams: 182 },
  { keywords: ['orange'], grams: 131 },
  { keywords: ['peach', 'pear', 'nectarine'], grams: 150 },
  { keywords: ['avocado'], grams: 150 },
  { keywords: ['chicken breast'], grams: 174 },
  { keywords: ['chicken thigh'], grams: 115 },
  { keywords: ['chicken drumstick'], grams: 95 },
  { keywords: ['salmon fillet', 'fish fillet'], grams: 170 },
  { keywords: ['tortilla'], grams: 45 },
  { keywords: ['bread', 'slice', 'bread slice'], grams: 30 },
  { keywords: ['bagel'], grams: 105 },
  { keywords: ['english muffin', 'muffin'], grams: 57 },
  { keywords: ['pita'], grams: 60 },
  { keywords: ['naan'], grams: 90 },
  { keywords: ['steak', 'pork chop', 'lamb chop'], grams: 200 },
  { keywords: ['sausage', 'hot dog'], grams: 75 },
  { keywords: ['bacon'], grams: 8 },
  { keywords: ['shrimp', 'prawn'], grams: 15 },
  { keywords: ['scallop'], grams: 20 },
  { keywords: ['tomato'], grams: 123 },
  { keywords: ['potato', 'sweet potato'], grams: 150 },
  { keywords: ['bell pepper'], grams: 120 },
  { keywords: ['onion'], grams: 110 },
  { keywords: ['garlic', 'garlic clove', 'clove'], grams: 3 },
  { keywords: ['lemon', 'lime'], grams: 58 },
  { keywords: ['date', 'dates', 'medjool'], grams: 24 },
  { keywords: ['fig'], grams: 50 },
  { keywords: ['kiwi'], grams: 76 },
  { keywords: ['mango'], grams: 200 },
  { keywords: ['cucumber'], grams: 300 },
  { keywords: ['carrot'], grams: 72 },
  { keywords: ['celery'], grams: 40 },
  { keywords: ['mushroom'], grams: 18 },
  { keywords: ['artichoke'], grams: 128 },
  { keywords: ['corn'], grams: 90 },
  { keywords: ['waffle', 'pancake'], grams: 75 },
];

/**
 * Look up food-specific grams per unit from a density map.
 * Returns the density for the first keyword match, or undefined if no match.
 */
function lookupDensity(
  foodName: string,
  densityMap: { keywords: string[]; grams: number }[]
): number | undefined {
  const lower = foodName.toLowerCase();
  for (const entry of densityMap) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.grams;
    }
  }
  return undefined;
}

export function convertToGrams(quantity: number, unit: string, foodName?: string): number {
  const u = unit.toLowerCase().trim();
  switch (u) {
    case 'g':
    case 'grams':
    case 'gram':
      return quantity;
    case 'oz':
    case 'ounce':
    case 'ounces':
      return quantity * 28.35;
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      return quantity * 453.6;
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return quantity * 1000;
    case 'cup':
    case 'cups': {
      if (foodName) {
        const density = lookupDensity(foodName, GRAMS_PER_CUP);
        if (density !== undefined) return quantity * density;
      }
      return quantity * 240; // default
    }
    case 'tbsp':
    case 'tablespoon':
    case 'tablespoons':
      return quantity * 15;
    case 'tsp':
    case 'teaspoon':
    case 'teaspoons':
      return quantity * 5;
    case 'ml':
    case 'milliliter':
    case 'milliliters':
      return quantity;
    case 'pieces':
    case 'piece':
    case 'count':
    case 'large':
    case 'medium':
    case 'small':
    case 'slices':
    case 'slice': {
      if (foodName) {
        const density = lookupDensity(foodName, GRAMS_PER_PIECE);
        if (density !== undefined) return quantity * density;
      }
      return quantity * 50; // default
    }
    default:
      return quantity * 100;
  }
}
