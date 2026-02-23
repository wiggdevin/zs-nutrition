import type { DraftMeal, Ingredient } from '../../types/schemas';
import type { FoodDetails } from '../../adapters/fatsecret';

/** Check if a meal is sweet/breakfast-oriented based on name and tags. */
function isSweetDish(meal: DraftMeal): boolean {
  const indicators = [
    'yogurt',
    'parfait',
    'smoothie',
    'pancake',
    'waffle',
    'oatmeal',
    'cereal',
    'fruit bowl',
    'acai',
    'granola',
    'french toast',
    'muffin',
    'overnight oats',
    'chia pudding',
    'berry',
    'banana bread',
    'maple',
    'honey',
    'chocolate',
    'protein shake',
  ];
  const text = `${meal.name} ${meal.foodSearchQuery} ${meal.tags.join(' ')}`.toLowerCase();
  return indicators.some((ind) => text.includes(ind));
}

/**
 * Build ingredient list from FatSecret food details.
 * Uses the serving with the highest calories for the most realistic portion size.
 */
export function buildIngredientsFromFood(
  foodDetails: FoodDetails,
  meal: DraftMeal,
  scaleFactor: number
): Ingredient[] {
  const ingredients: Ingredient[] = [];

  // Pick the serving with the highest calories (most complete portion)
  const primaryServing =
    foodDetails.servings.length > 1
      ? foodDetails.servings.reduce((best, s) => (s.calories > best.calories ? s : best))
      : foodDetails.servings[0];

  if (primaryServing) {
    ingredients.push({
      name: foodDetails.name,
      amount: Math.round((primaryServing.metricServingAmount || 100) * scaleFactor),
      unit: primaryServing.metricServingUnit || 'g',
      foodId: foodDetails.foodId,
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
  const queryWords = meal.foodSearchQuery.toLowerCase().split(/\s+/);

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

  // Add complementary seasoning/oil based on dish type
  if (isSweetDish(meal)) {
    ingredients.push({ name: 'Honey', amount: 1, unit: 'tbsp' });
    ingredients.push({ name: 'Cinnamon', amount: 0.5, unit: 'tsp' });
  } else {
    if (meal.cookTimeMin > 0 && !meal.tags.includes('no-cook')) {
      ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
    }
    ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });
  }

  return ingredients;
}

/**
 * Get complementary ingredients based on the meal's characteristics.
 * Includes healthy fat sources to prevent systematic fat deficit.
 */
export function getComplementaryIngredients(meal: DraftMeal): Ingredient[] {
  const ingredients: Ingredient[] = [];
  const query = meal.foodSearchQuery.toLowerCase();
  const mealName = meal.name.toLowerCase();
  const combinedText = `${query} ${mealName}`;

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

  // Add healthy fat source — prevents systematic fat deficit.
  // Only add if no fat-rich ingredient is already present in the query
  // AND the meal's fat budget is large enough to warrant it.
  const mealFatTarget = meal.targetNutrition?.fatG ?? 0;
  const mealKcalTarget = meal.targetNutrition?.kcal ?? 0;

  // Skip fat enrichment on low-fat-budget meals (< 8g fat target per meal,
  // typical of aggressive cuts with ~24-28g daily fat across 3-4 slots)
  const hasFatSource =
    combinedText.includes('avocado') ||
    combinedText.includes('salmon') ||
    combinedText.includes('nuts') ||
    combinedText.includes('almond') ||
    combinedText.includes('peanut') ||
    combinedText.includes('cheese') ||
    combinedText.includes('butter');

  if (!hasFatSource && !isSweetDish(meal) && mealFatTarget >= 8) {
    // Scale fat portion based on caloric budget
    const isLowCal = mealKcalTarget > 0 && mealKcalTarget < 350;
    const slot = meal.slot || '';
    if (
      slot.includes('breakfast') ||
      combinedText.includes('bowl') ||
      combinedText.includes('salad')
    ) {
      ingredients.push({ name: 'Avocado', amount: isLowCal ? 20 : 40, unit: 'g' });
    } else if (slot.includes('snack')) {
      ingredients.push({ name: 'Almonds, Raw', amount: isLowCal ? 8 : 15, unit: 'g' });
    } else {
      ingredients.push({
        name: 'Extra Virgin Olive Oil',
        amount: isLowCal ? 0.5 : 1,
        unit: 'tbsp',
      });
    }
  }

  // Add complementary seasoning/oil based on dish type
  if (isSweetDish(meal)) {
    ingredients.push({ name: 'Honey', amount: 1, unit: 'tbsp' });
    ingredients.push({ name: 'Cinnamon', amount: 0.5, unit: 'tsp' });
  } else {
    if (meal.cookTimeMin > 0) {
      ingredients.push({ name: 'Olive Oil', amount: 1, unit: 'tbsp' });
    }
    ingredients.push({ name: 'Salt and Pepper', amount: 1, unit: 'to taste' });
  }

  return ingredients;
}

/**
 * Generate cooking instructions based on meal characteristics.
 * Produces meal-specific steps referencing actual ingredients and cooking methods.
 */
export function generateInstructions(meal: DraftMeal, ingredients: Ingredient[]): string[] {
  const mainIngredients = ingredients
    .filter(
      (i) =>
        i.name !== 'Salt and Pepper' &&
        i.name !== 'Olive Oil' &&
        i.name !== 'Honey' &&
        i.name !== 'Cinnamon' &&
        i.name !== 'Maple Syrup'
    )
    .map((i) => i.name);

  const protein = meal.primaryProtein || mainIngredients[0] || 'main ingredient';
  const veggies = mainIngredients.filter(
    (n) => n !== protein && !n.toLowerCase().includes(protein.toLowerCase())
  );
  const vegList = veggies.length > 0 ? veggies.slice(0, 3).join(', ') : 'accompanying vegetables';

  const tags = meal.tags;
  const isSweet = isSweetDish(meal);

  // --- No-cook / raw meals (salads, yogurt parfaits, smoothies) ---
  if (tags.includes('no-cook') || meal.cookTimeMin === 0) {
    if (
      meal.name.toLowerCase().includes('smoothie') ||
      meal.foodSearchQuery.toLowerCase().includes('smoothie')
    ) {
      return [
        `Add ${mainIngredients.slice(0, 3).join(', ')} to a blender.`,
        `Pour in 1/2 cup of liquid (water, milk, or plant-based milk) for a smooth consistency.`,
        `Blend on high for 45-60 seconds until completely smooth and creamy.`,
        `Taste and adjust sweetness with honey or a frozen banana if needed.`,
        `Pour into a glass or bowl and add toppings like granola, seeds, or fresh fruit.`,
        `Serve immediately for the best texture and temperature.`,
      ];
    }
    if (isSweet) {
      return [
        `Start with a base layer of ${mainIngredients[0] || 'yogurt'} in a bowl or jar.`,
        `Add a layer of ${mainIngredients[1] || 'granola'} for crunch and texture.`,
        `Top with ${veggies[0] || 'fresh fruit'} and any remaining toppings.`,
        `Drizzle with honey or maple syrup and a pinch of cinnamon.`,
        `Repeat layers if making a parfait, finishing with fruit on top.`,
        `Serve chilled, or cover and refrigerate for up to 24 hours for meal prep.`,
      ];
    }
    // Savory no-cook (salad, wrap, etc.)
    return [
      `Wash and chop ${vegList} into bite-sized pieces.`,
      `Slice or dice ${protein} into thin, even portions for easy eating.`,
      `Arrange all ingredients in a large bowl or on a plate.`,
      `Drizzle with olive oil and a squeeze of fresh lemon juice.`,
      `Season with salt and pepper, then toss gently to combine.`,
      `Serve immediately or cover and refrigerate for up to 2 hours.`,
    ];
  }

  // --- Grill ---
  if (tags.includes('grill')) {
    const grillTime = Math.max(Math.round(meal.cookTimeMin / 2), 3);
    return [
      `Preheat your grill to medium-high heat (about 400-450°F / 200-230°C).`,
      `Pat ${protein} dry with paper towels, then season generously with salt, pepper, and your preferred spices.`,
      `Lightly oil the grill grates to prevent sticking.`,
      `Place ${protein} on the grill and cook for ${grillTime} minutes per side without moving, until grill marks form.`,
      `During the last few minutes, add ${vegList} to the grill alongside the protein.`,
      `Remove from heat and let the protein rest for 3-5 minutes before slicing.`,
      `Plate the grilled ${protein} with the charred vegetables and serve.`,
    ];
  }

  // --- Stir-fry / Sauté ---
  if (tags.includes('stir-fry') || tags.includes('saute') || tags.includes('sauté')) {
    const stirTime = Math.max(Math.round(meal.cookTimeMin / 3), 2);
    return [
      `Cut ${protein} into thin, even strips or bite-sized pieces for quick cooking.`,
      `Chop ${vegList} into similar-sized pieces so everything cooks evenly.`,
      `Heat 1 tablespoon of olive oil in a large wok or skillet over high heat until shimmering.`,
      `Add ${protein} in a single layer and sear for 2-3 minutes without stirring, then flip and cook another 2 minutes until browned.`,
      `Push ${protein} to the side, add ${vegList}, and stir-fry for ${stirTime} minutes until tender-crisp.`,
      `Add any sauce or seasoning, toss everything together, and cook for 1 more minute.`,
      `Serve hot over rice or noodles, garnished with fresh herbs or sesame seeds.`,
    ];
  }

  // --- Bake / Roast ---
  if (tags.includes('bake') || tags.includes('roast')) {
    return [
      `Preheat your oven to 400°F (200°C) and line a baking sheet with parchment paper.`,
      `Season ${protein} with olive oil, salt, pepper, and your choice of herbs or spices.`,
      `Arrange ${protein} on one side of the baking sheet, leaving space between pieces.`,
      `Toss ${vegList} with a drizzle of olive oil and spread on the other side of the sheet.`,
      `Roast for ${meal.cookTimeMin || 25} minutes, flipping halfway through, until the ${protein} reaches a safe internal temperature.`,
      `Let rest for 5 minutes, then plate and serve with any remaining sides.`,
    ];
  }

  // --- Default: pan-cook ---
  return [
    `Season ${protein} with salt, pepper, and any desired spices on both sides.`,
    `Heat 1 tablespoon of olive oil in a skillet over medium-high heat until the oil shimmers.`,
    `Add ${protein} to the pan and cook for ${Math.max(Math.round(meal.cookTimeMin / 2), 3)} minutes per side until golden brown and cooked through.`,
    `Remove ${protein} from the pan and set aside to rest on a plate.`,
    `In the same pan, add ${vegList} and sauté for 3-4 minutes until tender.`,
    `Return ${protein} to the pan, toss briefly with the vegetables, and adjust seasoning to taste.`,
    `Plate everything together and serve while hot.`,
  ];
}
