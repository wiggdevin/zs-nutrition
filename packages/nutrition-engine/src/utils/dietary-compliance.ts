/**
 * Shared allergen and dietary style compliance utilities.
 * Used by NutritionCompiler (to filter FatSecret matches) and
 * QAValidator (belt-and-suspenders compliance scan).
 */

/** Map common allergen names to search terms found in FatSecret product names. */
const ALLERGEN_TERM_MAP: Record<string, string[]> = {
  gluten: [
    'pasta',
    'bread',
    'wheat',
    'flour',
    'lasagna',
    'noodle',
    'cracker',
    'biscuit',
    'cereal',
    'couscous',
    'barley',
    'rye',
    'tortilla',
    'pita',
    'bagel',
    'croissant',
    'muffin',
    'pancake',
    'waffle',
  ],
  dairy: [
    'cheese',
    'milk',
    'butter',
    'cream',
    'yogurt',
    'whey',
    'casein',
    'ghee',
    'ricotta',
    'mozzarella',
    'parmesan',
    'cheddar',
    'brie',
    'feta',
    'gouda',
    'provolone',
    'cottage cheese',
    'sour cream',
    'ice cream',
    'custard',
  ],
  peanut: ['peanut'],
  'tree nut': [
    'almond',
    'walnut',
    'cashew',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
  ],
  tree_nut: [
    'almond',
    'walnut',
    'cashew',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'brazil nut',
    'pine nut',
  ],
  shellfish: [
    'shrimp',
    'crab',
    'lobster',
    'clam',
    'mussel',
    'oyster',
    'scallop',
    'crawfish',
    'crayfish',
    'prawn',
  ],
  soy: ['soy', 'tofu', 'tempeh', 'edamame', 'miso'],
  egg: ['egg'],
  fish: [
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'bass',
    'swordfish',
    'mahi',
  ],
  sesame: ['sesame', 'tahini'],
};

/** Terms forbidden by dietary style in product/ingredient names. */
const DIETARY_FORBIDDEN_TERMS: Record<string, string[]> = {
  vegan: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'shrimp',
    'crab',
    'lobster',
    'prawn',
    'egg',
    'cheese',
    'milk',
    'butter',
    'cream',
    'yogurt',
    'whey',
    'honey',
    'ghee',
    'gelatin',
    'lard',
  ],
  vegetarian: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'sardine',
    'anchovy',
    'mackerel',
    'trout',
    'halibut',
    'shrimp',
    'crab',
    'lobster',
    'prawn',
    'gelatin',
    'lard',
  ],
  pescatarian: [
    'chicken',
    'pork',
    'beef',
    'lamb',
    'turkey',
    'ham',
    'bacon',
    'sausage',
    'steak',
    'ribs',
    'brisket',
    'venison',
    'duck',
    'goose',
    'veal',
    'lard',
  ],
};

/**
 * Check if a product/ingredient name contains a term associated with a given allergen.
 */
export function containsAllergenTerm(name: string, allergen: string): boolean {
  const lower = name.toLowerCase();
  const allergenKey = allergen.toLowerCase().trim();
  const terms = ALLERGEN_TERM_MAP[allergenKey];
  if (!terms) {
    // Unknown allergen — do a simple substring check with the allergen name itself
    return lower.includes(allergenKey);
  }
  return terms.some((term) => lower.includes(term));
}

/**
 * Check if a product/ingredient name is compliant with a dietary style.
 * Returns true if compliant, false if the name contains a forbidden term.
 */
export function isDietaryCompliant(name: string, dietaryStyle: string): boolean {
  const lower = name.toLowerCase();
  const styleKey = dietaryStyle.toLowerCase().trim();
  const forbidden = DIETARY_FORBIDDEN_TERMS[styleKey];
  if (!forbidden) {
    // No restrictions for this style (e.g., keto, standard, high_protein)
    return true;
  }
  return !forbidden.some((term) => lower.includes(term));
}

/**
 * Check if a FatSecret product name is compliant with user's allergies and dietary style.
 * Returns true if the product is safe to use.
 */
export function isProductCompliant(
  productName: string,
  allergies: string[],
  dietaryStyle: string
): boolean {
  // Check allergens
  for (const allergen of allergies) {
    if (containsAllergenTerm(productName, allergen)) {
      return false;
    }
  }
  // Check dietary style
  if (!isDietaryCompliant(productName, dietaryStyle)) {
    return false;
  }
  return true;
}
