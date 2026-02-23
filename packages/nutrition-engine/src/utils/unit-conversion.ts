/**
 * Convert a quantity + unit to grams for per-100g scaling.
 * Shared utility used by NutritionCompiler and draft-macro-corrector.
 */
export function convertToGrams(quantity: number, unit: string): number {
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
    case 'cups':
      return quantity * 240;
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
    case 'slice':
      return quantity * 50;
    default:
      return quantity * 100;
  }
}
