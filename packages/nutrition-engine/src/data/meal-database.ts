/**
 * Meal Database Module
 *
 * Contains the full meal database used by the RecipeCurator for deterministic meal plan generation.
 * Organized by meal slot (breakfast, lunch, dinner, snack) with support for various dietary styles.
 */

/**
 * Meal candidate structure for deterministic meal selection
 */
export interface MealCandidate {
  name: string;
  cuisine: string;
  basePrepMin: number;
  baseCookMin: number;
  primaryProtein: string;
  searchQuery: string;
  tags: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Type for the meal database slot keys
 */
export type MealDatabaseSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Extended slot type that includes time-based snack slots
 */
export type ExtendedMealSlot =
  | MealDatabaseSlot
  | 'morning_snack'
  | 'afternoon_snack'
  | 'evening_snack';

/**
 * Full meal database organized by slot
 */
export const MEAL_DATABASE: Record<ExtendedMealSlot, MealCandidate[]> = {
  breakfast: [
    {
      name: 'Greek Yogurt Parfait with Berries and Granola',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'greek yogurt parfait berries',
      tags: ['dairy', 'quick', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Scrambled Eggs with Spinach and Whole Grain Toast',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 10,
      primaryProtein: 'eggs',
      searchQuery: 'scrambled eggs spinach toast',
      tags: ['eggs', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Overnight Oats with Banana and Almond Butter',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'overnight oats banana almond butter',
      tags: ['dairy', 'no-cook', 'meal-prep'],
      complexity: 'simple',
    },
    {
      name: 'Protein Smoothie Bowl with Mixed Berries',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'whey',
      searchQuery: 'protein smoothie bowl berries',
      tags: ['dairy', 'quick', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Avocado Toast with Poached Eggs and Cherry Tomatoes',
      cuisine: 'Australian',
      basePrepMin: 10,
      baseCookMin: 8,
      primaryProtein: 'eggs',
      searchQuery: 'avocado toast poached eggs',
      tags: ['eggs', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Turkey Sausage Breakfast Burrito',
      cuisine: 'Mexican',
      basePrepMin: 10,
      baseCookMin: 15,
      primaryProtein: 'turkey',
      searchQuery: 'turkey sausage breakfast burrito',
      tags: ['meat', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Whole Grain Pancakes with Fresh Blueberries',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'mixed',
      searchQuery: 'whole grain pancakes blueberries',
      tags: ['eggs', 'dairy'],
      complexity: 'moderate',
    },
    {
      name: 'Smoked Salmon Bagel with Cream Cheese',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'salmon',
      searchQuery: 'smoked salmon bagel cream cheese',
      tags: ['fish', 'dairy', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Vegetable Frittata with Bell Peppers',
      cuisine: 'Italian',
      basePrepMin: 10,
      baseCookMin: 20,
      primaryProtein: 'eggs',
      searchQuery: 'vegetable frittata bell peppers',
      tags: ['eggs', 'dairy'],
      complexity: 'moderate',
    },
    {
      name: 'Miso Soup with Tofu and Seaweed',
      cuisine: 'Japanese',
      basePrepMin: 5,
      baseCookMin: 10,
      primaryProtein: 'tofu',
      searchQuery: 'miso soup tofu seaweed',
      tags: ['vegan-friendly', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Japanese Rice Bowl with Natto and Egg',
      cuisine: 'Japanese',
      basePrepMin: 5,
      baseCookMin: 5,
      primaryProtein: 'mixed',
      searchQuery: 'japanese rice natto egg',
      tags: ['quick', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Italian Bruschetta with Tomato and Basil',
      cuisine: 'Italian',
      basePrepMin: 10,
      baseCookMin: 5,
      primaryProtein: 'mixed',
      searchQuery: 'bruschetta tomato basil',
      tags: ['vegan-friendly', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Chia Pudding with Mango and Coconut',
      cuisine: 'Thai',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'chia pudding mango coconut',
      tags: ['no-cook', 'meal-prep', 'vegan-friendly'],
      complexity: 'simple',
    },
    // Keto options
    {
      name: 'Bacon and Eggs with Avocado',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 15,
      primaryProtein: 'eggs',
      searchQuery: 'bacon eggs avocado',
      tags: ['keto', 'eggs', 'high-fat'],
      complexity: 'simple',
    },
    {
      name: 'Scrambled Eggs with Cheese and Heavy Cream',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 10,
      primaryProtein: 'eggs',
      searchQuery: 'scrambled eggs cheese heavy cream',
      tags: ['keto', 'eggs', 'dairy', 'high-fat'],
      complexity: 'simple',
    },
    {
      name: 'Keto Smoothie with Avocado and Coconut Milk',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'keto smoothie avocado coconut milk',
      tags: ['keto', 'high-fat', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Smoked Salmon with Cream Cheese',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'salmon',
      searchQuery: 'smoked salmon cream cheese',
      tags: ['keto', 'fish', 'dairy', 'high-fat', 'no-cook'],
      complexity: 'simple',
    },
    // Paleo options
    {
      name: 'Sweet Potato with Almond Butter and Berries',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'sweet potato almond butter berries',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Scrambled Eggs with Avocado and Tomato',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 10,
      primaryProtein: 'eggs',
      searchQuery: 'scrambled eggs avocado tomato',
      tags: ['paleo', 'grain-free', 'no-dairy'],
      complexity: 'simple',
    },
    {
      name: 'Coconut Chia Pudding with Berries',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'coconut chia pudding berries',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'meal-prep'],
      complexity: 'simple',
    },
  ],
  lunch: [
    {
      name: 'Grilled Chicken Caesar Salad',
      cuisine: 'Italian',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'chicken',
      searchQuery: 'grilled chicken caesar salad',
      tags: ['meat', 'grill'],
      complexity: 'moderate',
    },
    {
      name: 'Italian Caprese Sandwich with Mozzarella and Tomato',
      cuisine: 'Italian',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'caprese sandwich mozzarella tomato',
      tags: ['dairy', 'quick', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Minestrone Soup with Pasta and Vegetables',
      cuisine: 'Italian',
      basePrepMin: 10,
      baseCookMin: 25,
      primaryProtein: 'mixed',
      searchQuery: 'minestrone soup pasta vegetables',
      tags: ['vegan-friendly'],
      complexity: 'moderate',
    },
    {
      name: 'Chicken Katsu Curry Rice Bowl',
      cuisine: 'Japanese',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'chicken katsu curry rice',
      tags: ['meat'],
      complexity: 'moderate',
    },
    {
      name: 'Beef Teriyaki Bowl with Rice and Vegetables',
      cuisine: 'Japanese',
      basePrepMin: 10,
      baseCookMin: 15,
      primaryProtein: 'beef',
      searchQuery: 'beef teriyaki bowl rice vegetables',
      tags: ['meat', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Turkey and Avocado Wrap with Mixed Greens',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'turkey',
      searchQuery: 'turkey avocado wrap',
      tags: ['meat', 'quick', 'no-cook'],
      complexity: 'simple',
    },
    {
      name: 'Quinoa Power Bowl with Chickpeas and Tahini',
      cuisine: 'Mediterranean',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chickpeas',
      searchQuery: 'quinoa bowl chickpeas tahini',
      tags: ['vegan-friendly'],
      complexity: 'moderate',
    },
    {
      name: 'Mediterranean Grilled Chicken Bowl with Hummus',
      cuisine: 'Mediterranean',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'mediterranean chicken bowl hummus',
      tags: ['meat', 'grill'],
      complexity: 'moderate',
    },
    {
      name: 'Salmon Poke Bowl with Edamame and Rice',
      cuisine: 'Japanese',
      basePrepMin: 15,
      baseCookMin: 5,
      primaryProtein: 'salmon',
      searchQuery: 'salmon poke bowl edamame rice',
      tags: ['fish', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Southwest Black Bean and Corn Salad',
      cuisine: 'Mexican',
      basePrepMin: 15,
      baseCookMin: 10,
      primaryProtein: 'beans',
      searchQuery: 'southwest black bean corn salad',
      tags: ['vegan-friendly'],
      complexity: 'moderate',
    },
    {
      name: 'Asian Chicken Lettuce Wraps with Peanut Sauce',
      cuisine: 'Thai',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'chicken',
      searchQuery: 'asian chicken lettuce wraps',
      tags: ['meat', 'stir-fry'],
      complexity: 'moderate',
    },
    {
      name: 'Tuna Nicoise Salad with Hard-Boiled Eggs',
      cuisine: 'French',
      basePrepMin: 20,
      baseCookMin: 10,
      primaryProtein: 'tuna',
      searchQuery: 'tuna nicoise salad eggs',
      tags: ['fish', 'eggs'],
      complexity: 'moderate',
    },
    {
      name: 'Lentil Soup with Whole Grain Bread',
      cuisine: 'Indian',
      basePrepMin: 10,
      baseCookMin: 30,
      primaryProtein: 'lentils',
      searchQuery: 'lentil soup bread',
      tags: ['vegan-friendly'],
      complexity: 'complex',
    },
    {
      name: 'Beef and Broccoli Stir-Fry with Brown Rice',
      cuisine: 'Chinese',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'beef',
      searchQuery: 'beef broccoli stir fry brown rice',
      tags: ['meat', 'stir-fry'],
      complexity: 'moderate',
    },
    // Keto options
    {
      name: 'Cobb Salad with Bacon, Avocado, and Blue Cheese',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 10,
      primaryProtein: 'mixed',
      searchQuery: 'cobb salad bacon avocado blue cheese',
      tags: ['keto', 'eggs', 'dairy', 'high-fat'],
      complexity: 'moderate',
    },
    {
      name: 'Grilled Chicken with Garlic Butter and Asparagus',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'grilled chicken garlic butter asparagus',
      tags: ['keto', 'meat', 'high-fat', 'grill'],
      complexity: 'moderate',
    },
    {
      name: 'Salmon with Lemon Butter and Spinach',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 20,
      primaryProtein: 'salmon',
      searchQuery: 'salmon lemon butter spinach',
      tags: ['keto', 'fish', 'high-fat'],
      complexity: 'moderate',
    },
    {
      name: 'Zucchini Noodles with Pesto and Grilled Chicken',
      cuisine: 'Italian',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'chicken',
      searchQuery: 'zucchini noodles pesto grilled chicken',
      tags: ['keto', 'meat', 'grain-free'],
      complexity: 'moderate',
    },
    {
      name: 'Steak Salad with Blue Cheese Dressing',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'beef',
      searchQuery: 'steak salad blue cheese dressing',
      tags: ['keto', 'meat', 'dairy', 'high-fat'],
      complexity: 'moderate',
    },
    // Paleo options
    {
      name: 'Grilled Chicken with Roasted Sweet Potato and Broccoli',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 25,
      primaryProtein: 'chicken',
      searchQuery: 'grilled chicken roasted sweet potato broccoli',
      tags: ['paleo', 'grain-free', 'no-dairy', 'grill'],
      complexity: 'complex',
    },
    {
      name: 'Salmon with Asparagus and Sweet Potato',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 20,
      primaryProtein: 'salmon',
      searchQuery: 'salmon asparagus sweet potato',
      tags: ['paleo', 'grain-free', 'no-dairy', 'fish'],
      complexity: 'moderate',
    },
    {
      name: 'Steak Salad with Avocado and Tomato',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'beef',
      searchQuery: 'steak salad avocado tomato',
      tags: ['paleo', 'grain-free', 'no-dairy'],
      complexity: 'moderate',
    },
    {
      name: 'Chicken and Vegetable Stir-Fry with Cauliflower Rice',
      cuisine: 'Chinese',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'chicken',
      searchQuery: 'chicken vegetable stir fry cauliflower rice',
      tags: ['paleo', 'grain-free', 'no-dairy', 'stir-fry'],
      complexity: 'moderate',
    },
  ],
  dinner: [
    {
      name: 'Grilled Salmon with Roasted Sweet Potato and Asparagus',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 25,
      primaryProtein: 'salmon',
      searchQuery: 'grilled salmon sweet potato asparagus',
      tags: ['fish', 'grill'],
      complexity: 'complex',
    },
    {
      name: 'Chicken Stir-Fry with Brown Rice and Vegetables',
      cuisine: 'Chinese',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'chicken stir fry brown rice vegetables',
      tags: ['meat', 'stir-fry'],
      complexity: 'moderate',
    },
    {
      name: 'Lean Beef Tacos with Corn Tortillas and Salsa',
      cuisine: 'Mexican',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'beef',
      searchQuery: 'lean beef tacos corn tortillas',
      tags: ['meat'],
      complexity: 'moderate',
    },
    {
      name: 'Baked Cod with Lemon Herb Sweet Potato Mash',
      cuisine: 'British',
      basePrepMin: 15,
      baseCookMin: 30,
      primaryProtein: 'cod',
      searchQuery: 'baked cod lemon sweet potato',
      tags: ['fish', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Turkey Meatballs with Zucchini Noodles and Marinara',
      cuisine: 'Italian',
      basePrepMin: 20,
      baseCookMin: 25,
      primaryProtein: 'turkey',
      searchQuery: 'turkey meatballs zucchini noodles marinara',
      tags: ['meat', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Herb-Crusted Chicken Thighs with Roasted Vegetables',
      cuisine: 'French',
      basePrepMin: 15,
      baseCookMin: 35,
      primaryProtein: 'chicken',
      searchQuery: 'herb crusted chicken thighs roasted vegetables',
      tags: ['meat', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Shrimp and Vegetable Stir-Fry with Jasmine Rice',
      cuisine: 'Thai',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'shrimp',
      searchQuery: 'shrimp vegetable stir fry jasmine rice',
      tags: ['fish', 'stir-fry'],
      complexity: 'moderate',
    },
    {
      name: 'Pork Tenderloin with Apple Cider Glaze and Quinoa',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 30,
      primaryProtein: 'pork',
      searchQuery: 'pork tenderloin apple cider quinoa',
      tags: ['meat', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Chickpea and Spinach Curry with Basmati Rice',
      cuisine: 'Indian',
      basePrepMin: 15,
      baseCookMin: 25,
      primaryProtein: 'chickpeas',
      searchQuery: 'chickpea spinach curry basmati rice',
      tags: ['vegan-friendly'],
      complexity: 'complex',
    },
    {
      name: 'Grilled Tofu with Teriyaki Glaze and Stir-Fried Vegetables',
      cuisine: 'Japanese',
      basePrepMin: 20,
      baseCookMin: 20,
      primaryProtein: 'tofu',
      searchQuery: 'grilled tofu teriyaki stir fry vegetables',
      tags: ['vegan-friendly', 'grill'],
      complexity: 'complex',
    },
    {
      name: 'Eggplant Parmigiana with Whole Wheat Pasta',
      cuisine: 'Italian',
      basePrepMin: 20,
      baseCookMin: 40,
      primaryProtein: 'mixed',
      searchQuery: 'eggplant parmigiana whole wheat pasta',
      tags: ['vegetarian'],
      complexity: 'complex',
    },
    {
      name: 'Japanese Chicken Teriyaki with Steamed Rice',
      cuisine: 'Japanese',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'chicken teriyaki steamed rice',
      tags: ['meat', 'quick'],
      complexity: 'moderate',
    },
    {
      name: 'Spaghetti Bolognese with Lean Beef',
      cuisine: 'Italian',
      basePrepMin: 15,
      baseCookMin: 30,
      primaryProtein: 'beef',
      searchQuery: 'spaghetti bolognese lean beef',
      tags: ['meat'],
      complexity: 'complex',
    },
    {
      name: 'Salmon Teriyaki with Soba Noodles',
      cuisine: 'Japanese',
      basePrepMin: 15,
      baseCookMin: 15,
      primaryProtein: 'salmon',
      searchQuery: 'salmon teriyaki soba noodles',
      tags: ['fish', 'quick'],
      complexity: 'moderate',
    },
    // Keto options
    {
      name: 'Pan-Seared Steak with Garlic Butter',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 20,
      primaryProtein: 'beef',
      searchQuery: 'pan seared steak garlic butter',
      tags: ['keto', 'meat', 'high-fat'],
      complexity: 'moderate',
    },
    {
      name: 'Baked Salmon with Cream Cheese Spinach',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 25,
      primaryProtein: 'salmon',
      searchQuery: 'baked salmon cream cheese spinach',
      tags: ['keto', 'fish', 'dairy', 'high-fat', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Chicken Thighs with Skin and Roasted Vegetables',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 40,
      primaryProtein: 'chicken',
      searchQuery: 'chicken thighs skin roasted vegetables',
      tags: ['keto', 'meat', 'high-fat', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Shrimp with Zucchini Noodles in Alfredo Sauce',
      cuisine: 'Italian',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'shrimp',
      searchQuery: 'shrimp zucchini noodles alfredo sauce',
      tags: ['keto', 'fish', 'dairy', 'high-fat'],
      complexity: 'moderate',
    },
    // Paleo options
    {
      name: 'Grilled Steak with Roasted Vegetables',
      cuisine: 'American',
      basePrepMin: 10,
      baseCookMin: 25,
      primaryProtein: 'beef',
      searchQuery: 'grilled steak roasted vegetables',
      tags: ['paleo', 'grain-free', 'no-dairy', 'grill'],
      complexity: 'complex',
    },
    {
      name: 'Baked Salmon with Lemon and Asparagus',
      cuisine: 'American',
      basePrepMin: 15,
      baseCookMin: 25,
      primaryProtein: 'salmon',
      searchQuery: 'baked salmon lemon asparagus',
      tags: ['paleo', 'grain-free', 'no-dairy', 'fish', 'bake'],
      complexity: 'complex',
    },
    {
      name: 'Chicken Stir-Fry with Cauliflower Rice',
      cuisine: 'Chinese',
      basePrepMin: 15,
      baseCookMin: 20,
      primaryProtein: 'chicken',
      searchQuery: 'chicken stir fry cauliflower rice',
      tags: ['paleo', 'grain-free', 'no-dairy', 'stir-fry'],
      complexity: 'moderate',
    },
  ],
  snack: [
    {
      name: 'Apple Slices with Almond Butter',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'apple slices almond butter',
      tags: ['no-cook', 'quick', 'vegan-friendly'],
      complexity: 'simple',
    },
    {
      name: 'Protein Bar (Chocolate Peanut Butter)',
      cuisine: 'American',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'whey',
      searchQuery: 'protein bar chocolate peanut butter',
      tags: ['dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Trail Mix with Nuts and Dried Fruit',
      cuisine: 'American',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'trail mix nuts dried fruit',
      tags: ['no-cook', 'quick', 'vegan-friendly'],
      complexity: 'simple',
    },
    {
      name: 'Cottage Cheese with Pineapple Chunks',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'cottage cheese pineapple',
      tags: ['dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Rice Cakes with Peanut Butter and Banana',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'rice cakes peanut butter banana',
      tags: ['no-cook', 'quick', 'vegan-friendly'],
      complexity: 'simple',
    },
    {
      name: 'Hummus with Carrot and Celery Sticks',
      cuisine: 'Mediterranean',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'chickpeas',
      searchQuery: 'hummus carrot celery sticks',
      tags: ['no-cook', 'quick', 'vegan-friendly'],
      complexity: 'simple',
    },
    {
      name: 'Hard-Boiled Eggs with Everything Seasoning',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 12,
      primaryProtein: 'eggs',
      searchQuery: 'hard boiled eggs seasoning',
      tags: ['eggs', 'meal-prep'],
      complexity: 'moderate',
    },
    {
      name: 'Greek Yogurt with Honey and Walnuts',
      cuisine: 'Greek',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'greek yogurt honey walnuts',
      tags: ['dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Edamame with Sea Salt',
      cuisine: 'Japanese',
      basePrepMin: 2,
      baseCookMin: 5,
      primaryProtein: 'soy',
      searchQuery: 'edamame sea salt',
      tags: ['vegan-friendly', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Rice Crackers with Nori and Sesame',
      cuisine: 'Japanese',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'rice crackers nori sesame',
      tags: ['no-cook', 'quick', 'vegan-friendly'],
      complexity: 'simple',
    },
    {
      name: 'Italian Mozzarella and Tomato Skewers',
      cuisine: 'Italian',
      basePrepMin: 10,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'mozzarella tomato skewers',
      tags: ['dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Dark Chocolate Almonds (30g)',
      cuisine: 'American',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'dark chocolate almonds',
      tags: ['no-cook', 'quick'],
      complexity: 'simple',
    },
    // Keto options
    {
      name: 'Cheese and Nuts',
      cuisine: 'American',
      basePrepMin: 2,
      baseCookMin: 0,
      primaryProtein: 'dairy',
      searchQuery: 'cheese nuts',
      tags: ['keto', 'dairy', 'high-fat', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Avocado with Everything Bagel Seasoning',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'avocado everything bagel seasoning',
      tags: ['keto', 'high-fat', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Hard-Boiled Eggs with Mayonnaise',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 12,
      primaryProtein: 'eggs',
      searchQuery: 'hard boiled eggs mayonnaise',
      tags: ['keto', 'eggs', 'high-fat', 'meal-prep'],
      complexity: 'moderate',
    },
    {
      name: 'Pork Rinds with Guacamole',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'pork',
      searchQuery: 'pork rinds guacamole',
      tags: ['keto', 'meat', 'high-fat', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    // Paleo options
    {
      name: 'Mixed Nuts and Seeds',
      cuisine: 'American',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'mixed nuts seeds',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Apple Slices with Cashew Butter',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'apple slices cashew butter',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Beef Jerky',
      cuisine: 'American',
      basePrepMin: 0,
      baseCookMin: 0,
      primaryProtein: 'beef',
      searchQuery: 'beef jerky',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
    {
      name: 'Carrot Sticks with Almond Butter',
      cuisine: 'American',
      basePrepMin: 5,
      baseCookMin: 0,
      primaryProtein: 'mixed',
      searchQuery: 'carrot sticks almond butter',
      tags: ['paleo', 'grain-free', 'no-dairy', 'no-cook', 'quick'],
      complexity: 'simple',
    },
  ],
  // Additional slot mappings - empty arrays as they use the main snack array
  morning_snack: [],
  afternoon_snack: [],
  evening_snack: [],
};

/**
 * Get all meals for a specific slot
 * Falls back to 'snack' for time-based snack slots
 */
export function getMealsBySlot(slot: string): MealCandidate[] {
  const normalizedSlot = slot.toLowerCase();

  // Handle time-based snack slots by returning the main snack array
  if (
    normalizedSlot.includes('snack') &&
    normalizedSlot !== 'snack' &&
    MEAL_DATABASE[normalizedSlot as ExtendedMealSlot]?.length === 0
  ) {
    return [...MEAL_DATABASE.snack];
  }

  return [...(MEAL_DATABASE[normalizedSlot as ExtendedMealSlot] || MEAL_DATABASE.snack)];
}

/**
 * Get meals filtered by dietary preference
 * Returns all meals for omnivore, or filtered meals for specific diets
 */
export function getMealsByDiet(slot: string, diet: string): MealCandidate[] {
  const meals = getMealsBySlot(slot);

  if (diet === 'omnivore') {
    return meals;
  }

  return meals.filter((m) => m.tags?.includes(diet.toLowerCase()));
}

/**
 * Get all available primary meal slots (not including time-based snack slots)
 */
export function getAvailableSlots(): MealDatabaseSlot[] {
  return ['breakfast', 'lunch', 'dinner', 'snack'];
}

/**
 * Get all meal slots including time-based snack slots
 */
export function getAllSlots(): ExtendedMealSlot[] {
  return Object.keys(MEAL_DATABASE) as ExtendedMealSlot[];
}

/**
 * Get total meal count across all primary slots
 */
export function getTotalMealCount(): number {
  return (
    MEAL_DATABASE.breakfast.length +
    MEAL_DATABASE.lunch.length +
    MEAL_DATABASE.dinner.length +
    MEAL_DATABASE.snack.length
  );
}

/**
 * Get meal count by slot
 */
export function getMealCountBySlot(slot: string): number {
  return getMealsBySlot(slot).length;
}

/**
 * Get all unique cuisines in the database
 */
export function getAvailableCuisines(): string[] {
  const cuisines = new Set<string>();

  for (const slot of getAvailableSlots()) {
    for (const meal of MEAL_DATABASE[slot]) {
      cuisines.add(meal.cuisine);
    }
  }

  return [...cuisines].sort();
}

/**
 * Get all unique proteins in the database
 */
export function getAvailableProteins(): string[] {
  const proteins = new Set<string>();

  for (const slot of getAvailableSlots()) {
    for (const meal of MEAL_DATABASE[slot]) {
      proteins.add(meal.primaryProtein);
    }
  }

  return [...proteins].sort();
}
