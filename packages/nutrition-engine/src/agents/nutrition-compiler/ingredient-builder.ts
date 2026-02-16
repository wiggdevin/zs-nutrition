import type { DraftMeal, Ingredient } from '../../types/schemas';
import type { FoodDetails } from '../../adapters/fatsecret';

/**
 * Build ingredient list from FatSecret food details.
 */
export function buildIngredientsFromFood(
  foodDetails: FoodDetails,
  meal: DraftMeal,
  scaleFactor: number
): Ingredient[] {
  const ingredients: Ingredient[] = [];

  // Primary ingredient from FatSecret
  const primaryServing = foodDetails.servings[0];
  if (primaryServing) {
    ingredients.push({
      name: foodDetails.name,
      amount: Math.round((primaryServing.metricServingAmount || 100) * scaleFactor),
      unit: primaryServing.metricServingUnit || 'g',
      fatsecretFoodId: foodDetails.foodId,
    });
  }

  // Add complementary ingredients based on meal tags/search query
  const complementary = getComplementaryIngredients(meal);
  ingredients.push(...complementary);

  return ingredients;
}

/**
 * Generate estimated ingredients when FatSecret data is unavailable.
 */
export function generateEstimatedIngredients(meal: DraftMeal): Ingredient[] {
  const ingredients: Ingredient[] = [];

  // Parse the search query for ingredient hints
  const queryWords = meal.fatsecretSearchQuery.toLowerCase().split(/\s+/);

  // Common protein sources
  const proteinMap: Record<string, { name: string; amount: number; unit: string }> = {
    chicken: { name: 'Chicken Breast', amount: 170, unit: 'g' },
    salmon: { name: 'Salmon Fillet', amount: 170, unit: 'g' },
    beef: { name: 'Lean Ground Beef', amount: 150, unit: 'g' },
    turkey: { name: 'Turkey Breast', amount: 150, unit: 'g' },
    eggs: { name: 'Eggs', amount: 3, unit: 'large' },
    egg: { name: 'Eggs', amount: 2, unit: 'large' },
    tuna: { name: 'Tuna, Canned in Water', amount: 142, unit: 'g' },
    shrimp: { name: 'Shrimp', amount: 150, unit: 'g' },
    tofu: { name: 'Firm Tofu', amount: 200, unit: 'g' },
    cod: { name: 'Cod Fillet', amount: 170, unit: 'g' },
    pork: { name: 'Pork Tenderloin', amount: 150, unit: 'g' },
    yogurt: { name: 'Greek Yogurt, Plain', amount: 200, unit: 'g' },
    chickpeas: { name: 'Chickpeas, Cooked', amount: 150, unit: 'g' },
    lentils: { name: 'Lentils, Cooked', amount: 150, unit: 'g' },
    beans: { name: 'Black Beans, Cooked', amount: 150, unit: 'g' },
  };

  // Add protein source
  let addedProtein = false;
  for (const word of queryWords) {
    if (proteinMap[word]) {
      ingredients.push(proteinMap[word]);
      addedProtein = true;
      break;
    }
  }

  if (!addedProtein && meal.primaryProtein && proteinMap[meal.primaryProtein]) {
    ingredients.push(proteinMap[meal.primaryProtein]);
  }

  // Common carb sources
  const carbMap: Record<string, { name: string; amount: number; unit: string }> = {
    rice: { name: 'Brown Rice, Cooked', amount: 150, unit: 'g' },
    quinoa: { name: 'Quinoa, Cooked', amount: 150, unit: 'g' },
    pasta: { name: 'Whole Wheat Pasta, Cooked', amount: 140, unit: 'g' },
    bread: { name: 'Whole Wheat Bread', amount: 2, unit: 'slices' },
    toast: { name: 'Whole Grain Toast', amount: 2, unit: 'slices' },
    oats: { name: 'Rolled Oats', amount: 50, unit: 'g' },
    potato: { name: 'Sweet Potato', amount: 150, unit: 'g' },
    tortillas: { name: 'Corn Tortillas', amount: 3, unit: 'pieces' },
    wrap: { name: 'Whole Wheat Tortilla', amount: 1, unit: 'large' },
    bagel: { name: 'Whole Grain Bagel', amount: 1, unit: 'piece' },
    pancakes: { name: 'Whole Grain Pancake Mix', amount: 80, unit: 'g' },
  };

  for (const word of queryWords) {
    if (carbMap[word]) {
      ingredients.push(carbMap[word]);
      break;
    }
  }

  // Common vegetables/additions
  const vegMap: Record<string, { name: string; amount: number; unit: string }> = {
    spinach: { name: 'Fresh Spinach', amount: 60, unit: 'g' },
    broccoli: { name: 'Broccoli Florets', amount: 100, unit: 'g' },
    avocado: { name: 'Avocado', amount: 0.5, unit: 'medium' },
    tomatoes: { name: 'Cherry Tomatoes', amount: 80, unit: 'g' },
    peppers: { name: 'Bell Peppers', amount: 100, unit: 'g' },
    vegetables: { name: 'Mixed Vegetables', amount: 150, unit: 'g' },
    berries: { name: 'Mixed Berries', amount: 100, unit: 'g' },
    banana: { name: 'Banana', amount: 1, unit: 'medium' },
    mango: { name: 'Mango, Diced', amount: 100, unit: 'g' },
    lettuce: { name: 'Romaine Lettuce', amount: 60, unit: 'g' },
    salad: { name: 'Mixed Greens', amount: 80, unit: 'g' },
    corn: { name: 'Corn Kernels', amount: 80, unit: 'g' },
    zucchini: { name: 'Zucchini', amount: 150, unit: 'g' },
    mushrooms: { name: 'Mushrooms, Sliced', amount: 80, unit: 'g' },
  };

  for (const word of queryWords) {
    if (vegMap[word]) {
      ingredients.push(vegMap[word]);
    }
  }

  // If still no ingredients, add generic ones
  if (ingredients.length === 0) {
    ingredients.push(
      { name: 'Primary Ingredient', amount: 150, unit: 'g' },
      { name: 'Secondary Ingredient', amount: 100, unit: 'g' }
    );
  }

  // Add cooking oil for cooked meals
  if (meal.cookTimeMin > 0 && !meal.tags.includes('no-cook')) {
    ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
  }

  // Add seasoning
  ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });

  return ingredients;
}

/**
 * Get complementary ingredients based on the meal's characteristics.
 */
export function getComplementaryIngredients(meal: DraftMeal): Ingredient[] {
  const ingredients: Ingredient[] = [];
  const query = meal.fatsecretSearchQuery.toLowerCase();

  // Add carb source if mentioned in query
  if (query.includes('rice')) {
    ingredients.push({ name: 'Brown Rice, Cooked', amount: 150, unit: 'g' });
  } else if (query.includes('quinoa')) {
    ingredients.push({ name: 'Quinoa, Cooked', amount: 150, unit: 'g' });
  } else if (query.includes('toast') || query.includes('bread')) {
    ingredients.push({ name: 'Whole Grain Bread', amount: 2, unit: 'slices' });
  } else if (query.includes('pasta') || query.includes('noodles')) {
    ingredients.push({ name: 'Whole Wheat Pasta', amount: 140, unit: 'g' });
  }

  // Add vegetable if mentioned
  if (query.includes('spinach')) {
    ingredients.push({ name: 'Fresh Spinach', amount: 60, unit: 'g' });
  } else if (query.includes('broccoli')) {
    ingredients.push({ name: 'Broccoli Florets', amount: 100, unit: 'g' });
  } else if (query.includes('asparagus')) {
    ingredients.push({ name: 'Asparagus Spears', amount: 100, unit: 'g' });
  } else if (query.includes('vegetables')) {
    ingredients.push({ name: 'Mixed Vegetables', amount: 150, unit: 'g' });
  }

  // Add seasoning
  if (meal.cookTimeMin > 0) {
    ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
  }
  ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });

  return ingredients;
}

/**
 * Generate cooking instructions based on meal characteristics.
 */
export function generateInstructions(meal: DraftMeal, ingredients: Ingredient[]): string[] {
  const instructions: string[] = [];

  // Prep step
  const ingredientNames = ingredients
    .filter((i) => i.name !== 'Salt and Pepper' && i.name !== 'Olive Oil')
    .map((i) => i.name.toLowerCase())
    .slice(0, 3);

  instructions.push(
    `Prepare all ingredients: wash, measure, and portion ${ingredientNames.join(', ')}.`
  );

  if (meal.tags.includes('no-cook')) {
    instructions.push(`Combine ingredients in a bowl or container.`);
    instructions.push(
      `Mix well and serve${meal.tags.includes('meal-prep') ? ' or refrigerate for later' : ''}.`
    );
  } else {
    // Cooking method based on tags
    if (meal.tags.includes('grill')) {
      instructions.push(`Preheat grill to medium-high heat.`);
      instructions.push(
        `Season ${meal.primaryProtein || 'protein'} with salt, pepper, and desired spices.`
      );
      instructions.push(
        `Grill for ${Math.round(meal.cookTimeMin / 2)} minutes per side until cooked through.`
      );
    } else if (meal.tags.includes('stir-fry')) {
      instructions.push(`Heat olive oil in a large skillet or wok over high heat.`);
      instructions.push(
        `Add ${meal.primaryProtein || 'protein'} and stir-fry for 3-4 minutes until browned.`
      );
      instructions.push(
        `Add vegetables and cook for another ${Math.round(meal.cookTimeMin / 3)} minutes.`
      );
    } else if (meal.tags.includes('bake')) {
      instructions.push(`Preheat oven to 375°F (190°C).`);
      instructions.push(
        `Season ${meal.primaryProtein || 'protein'} and place on a lined baking sheet.`
      );
      instructions.push(
        `Bake for ${meal.cookTimeMin} minutes until internal temperature reaches safe levels.`
      );
    } else {
      instructions.push(`Heat a pan over medium heat with olive oil.`);
      instructions.push(
        `Cook ${meal.primaryProtein || 'main ingredient'} for ${meal.cookTimeMin} minutes until done.`
      );
    }

    instructions.push(`Plate and serve with sides. Season to taste.`);
  }

  return instructions;
}
