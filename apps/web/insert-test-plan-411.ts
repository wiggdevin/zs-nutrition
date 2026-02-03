import { PrismaClient } from '@prisma/client';

// Set DATABASE_URL explicitly for this script
process.env.DATABASE_URL = 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db';

const prisma = new PrismaClient();

async function insertTestPlan411() {
  console.log('Creating test meal plan for Feature #411 verification...');

  // Create or get test user
  let user = await prisma.user.findFirst({
    where: { email: 'test-411-verify@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: 'dev_test_411_user',
        email: 'test-411-verify@example.com',
      },
    });
    console.log('Created test user:', user.id);
  }

  // Create profile
  let profile = await prisma.userProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Test User 411',
        sex: 'male',
        age: 30,
        heightCm: 177.8,
        weightKg: 77.11,
        activityLevel: 'moderately_active',
        goalType: 'maintain',
        goalRate: 1,
        bmrKcal: 1750,
        tdeeKcal: 2000,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 67,
        trainingDays: JSON.stringify([1, 3, 5]),
        dietaryStyle: 'omnivore',
        allergies: JSON.stringify([]),
        exclusions: JSON.stringify([]),
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        isActive: true,
      },
    });
    console.log('Created profile:', profile.id);
  }

  // Create onboarding state
  let onboarding = await prisma.onboardingState.findFirst({
    where: { userId: user.id },
  });

  if (!onboarding) {
    onboarding = await prisma.onboardingState.create({
      data: {
        userId: user.id,
        completed: true,
        currentStep: 7,
      },
    });
    console.log('Created onboarding state');
  }

  // Deactivate any existing plans
  await prisma.mealPlan.updateMany({
    where: { userId: user.id, status: 'active' },
    data: { status: 'replaced' },
  });

  // Build the validated plan with complete ingredient lists
  const validatedPlanData = {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: true,
        targetKcal: 2300,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Oatmeal with Protein Powder and Berries',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            nutrition: { kcal: 550, proteinG: 35, carbsG: 65, fatG: 12, fiberG: 8 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Rolled Oats', amount: 80, unit: 'g', fatsecretFoodId: '19091' },
              { name: 'Whey Protein Powder', amount: 30, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Blueberries', amount: 100, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Almond Milk', amount: 200, unit: 'ml', fatsecretFoodId: '36495' },
              { name: 'Honey', amount: 1, unit: 'tbsp', fatsecretFoodId: '19099' },
              { name: 'Cinnamon', amount: 0.5, unit: 'tsp', fatsecretFoodId: '2010' },
            ],
            instructions: [
              'Combine oats and almond milk in a microwave-safe bowl',
              'Microwave for 2 minutes, stirring halfway through',
              'Stir in protein powder until smooth',
              'Top with blueberries, honey, and cinnamon',
              'Serve immediately and enjoy'
            ],
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad with Avocado',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 12,
            nutrition: { kcal: 650, proteinG: 45, carbsG: 40, fatG: 22, fiberG: 10 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken Breast', amount: 150, unit: 'g', fatsecretFoodId: '6165' },
              { name: 'Mixed Greens', amount: 150, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Avocado', amount: 0.5, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Cherry Tomatoes', amount: 100, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Cucumber', amount: 0.5, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Red Onion', amount: 0.25, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Olive Oil', amount: 1, unit: 'tbsp', fatsecretFoodId: '29059' },
              { name: 'Lemon Juice', amount: 1, unit: 'tbsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Season chicken breast with salt and pepper',
              'Grill chicken for 12 minutes until fully cooked',
              'Let chicken rest for 5 minutes, then slice',
              'Combine mixed greens, tomatoes, cucumber, and onion in a large bowl',
              'Top with sliced chicken and avocado',
              'Drizzle with olive oil and lemon juice',
              'Toss gently and serve'
            ],
          },
          {
            slot: 'Dinner',
            name: 'Baked Salmon with Sweet Potato and Asparagus',
            cuisine: 'American',
            prepTimeMin: 15,
            cookTimeMin: 25,
            nutrition: { kcal: 700, proteinG: 40, carbsG: 55, fatG: 28, fiberG: 12 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Atlantic Salmon Fillet', amount: 180, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Sweet Potato', amount: 300, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Asparagus', amount: 200, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Olive Oil', amount: 1.5, unit: 'tbsp', fatsecretFoodId: '29059' },
              { name: 'Garlic', amount: 2, unit: 'cloves', fatsecretFoodId: '29059' },
              { name: 'Lemon', amount: 0.5, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Dill', amount: 1, unit: 'tbsp', fatsecretFoodId: '29059' },
              { name: 'Salt', amount: 0.5, unit: 'tsp', fatsecretFoodId: '29059' },
              { name: 'Black Pepper', amount: 0.25, unit: 'tsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Preheat oven to 400°F (200°C)',
              'Peel and cube sweet potato into 1-inch pieces',
              'Trim woody ends from asparagus',
              'Toss sweet potato and asparagus with olive oil, salt, and pepper',
              'Place vegetables on a baking sheet and roast for 15 minutes',
              'Season salmon with garlic, lemon juice, salt, and pepper',
              'Add salmon to the baking sheet with vegetables',
              'Bake for 12-15 minutes until salmon is cooked through',
              'Garnish with fresh dill and serve'
            ],
          },
          {
            slot: 'Snack',
            name: 'Greek Yogurt with Berries and Honey',
            cuisine: 'American',
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: { kcal: 400, proteinG: 20, carbsG: 40, fatG: 10, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Greek Yogurt', amount: 200, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Strawberries', amount: 100, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Raspberries', amount: 50, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Honey', amount: 1, unit: 'tbsp', fatsecretFoodId: '29059' },
              { name: 'Granola', amount: 30, unit: 'g', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Add Greek yogurt to a bowl',
              'Wash and slice strawberries',
              'Top yogurt with strawberries and raspberries',
              'Drizzle with honey',
              'Sprinkle granola on top and serve'
            ],
          },
        ],
      },
      {
        dayNumber: 2,
        dayName: 'Tuesday',
        isTrainingDay: false,
        targetKcal: 2000,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Scrambled Eggs with Spinach and Whole Wheat Toast',
            cuisine: 'American',
            prepTimeMin: 8,
            cookTimeMin: 5,
            nutrition: { kcal: 500, proteinG: 25, carbsG: 45, fatG: 18, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Large Eggs', amount: 3, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Fresh Spinach', amount: 50, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Whole Wheat Bread', amount: 2, unit: 'slices', fatsecretFoodId: '29059' },
              { name: 'Butter', amount: 1, unit: 'tsp', fatsecretFoodId: '29059' },
              { name: 'Cheddar Cheese', amount: 30, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Salt', amount: 0.25, unit: 'tsp', fatsecretFoodId: '29059' },
              { name: 'Black Pepper', amount: 0.125, unit: 'tsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Toast the bread and spread with butter',
              'Whisk eggs with salt and pepper',
              'Sauté spinach in a non-stick pan for 1 minute',
              'Pour eggs into the pan and scramble until cooked',
              'Stir in cheese until melted',
              'Serve eggs over toast'
            ],
          },
          {
            slot: 'Lunch',
            name: 'Turkey Club Wrap',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 0,
            nutrition: { kcal: 600, proteinG: 35, carbsG: 50, fatG: 20, fiberG: 4 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Whole Wheat Tortilla', amount: 1, unit: 'large', fatsecretFoodId: '29059' },
              { name: 'Sliced Turkey Breast', amount: 120, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Bacon', amount: 2, unit: 'slices', fatsecretFoodId: '29059' },
              { name: 'Lettuce', amount: 2, unit: 'leaves', fatsecretFoodId: '29059' },
              { name: 'Tomato', amount: 3, unit: 'slices', fatsecretFoodId: '29059' },
              { name: 'Avocado', amount: 0.25, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Mayonnaise', amount: 1, unit: 'tbsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Lay tortilla flat on a plate',
              'Spread mayonnaise over the tortilla',
              'Layer turkey, bacon, lettuce, tomato, and avocado',
              'Fold in the sides and roll tightly',
              'Slice in half diagonally and serve'
            ],
          },
          {
            slot: 'Dinner',
            name: 'Chicken Stir Fry with Brown Rice',
            cuisine: 'Asian',
            prepTimeMin: 15,
            cookTimeMin: 15,
            nutrition: { kcal: 650, proteinG: 38, carbsG: 52, fatG: 22, fiberG: 7 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken Breast', amount: 140, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Brown Rice', amount: 150, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Broccoli', amount: 100, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Bell Pepper', amount: 1, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Carrots', amount: 80, unit: 'g', fatsecretFoodId: '29059' },
              { name: 'Soy Sauce', amount: 2, unit: 'tbsp', fatsecretFoodId: '29059' },
              { name: 'Sesame Oil', amount: 1, unit: 'tsp', fatsecretFoodId: '29059' },
              { name: 'Garlic', amount: 2, unit: 'cloves', fatsecretFoodId: '29059' },
              { name: 'Ginger', amount: 1, unit: 'tsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Cook brown rice according to package directions',
              'Slice chicken into bite-sized strips',
              'Cut vegetables into thin strips',
              'Heat sesame oil in a wok over high heat',
              'Stir-fry chicken until cooked through, about 5 minutes',
              'Add garlic and ginger, stir for 30 seconds',
              'Add vegetables and stir-fry for 3-4 minutes',
              'Add soy sauce and toss to combine',
              'Serve over brown rice'
            ],
          },
          {
            slot: 'Snack',
            name: 'Apple with Almond Butter',
            cuisine: 'American',
            prepTimeMin: 2,
            cookTimeMin: 0,
            nutrition: { kcal: 250, proteinG: 8, carbsG: 30, fatG: 12, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Medium Apple', amount: 1, unit: 'whole', fatsecretFoodId: '29059' },
              { name: 'Almond Butter', amount: 2, unit: 'tbsp', fatsecretFoodId: '29059' },
            ],
            instructions: [
              'Wash and slice the apple',
              'Serve with almond butter for dipping'
            ],
          },
        ],
      },
    ],
    groceryList: [],
    qa: { status: 'PASS', score: 95, iterations: 1 },
    weeklyTotals: {
      avgKcal: 2150,
      avgProteinG: 142,
      avgCarbsG: 188,
      avgFatG: 63,
    },
  };

  const metabolicProfileData = {
    bmrKcal: 1750,
    tdeeKcal: 2000,
    goalKcal: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 67,
  };

  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      status: 'active',
      dailyKcalTarget: 2000,
      dailyProteinG: 150,
      dailyCarbsG: 200,
      dailyFatG: 67,
      trainingBonusKcal: 300,
      planDays: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      qaScore: 95,
      qaStatus: 'approved',
      generatedAt: new Date(),
      validatedPlan: JSON.stringify(validatedPlanData),
      metabolicProfile: JSON.stringify(metabolicProfileData),
    },
  });

  console.log('Created test meal plan:', plan.id);
  console.log('Test plan URL: http://localhost:3000/meal-plan');
  console.log('');
  console.log('Feature #411 Test Data Created Successfully!');
  console.log('The meal plan includes:');
  console.log('- Complete ingredient lists with amounts and units');
  console.log('- FatSecret food IDs associated with ingredients');
  console.log('- Multiple meals across 2 days with varying ingredient counts');
  console.log('- Scrollable ingredient lists for verification');
}

insertTestPlan411()
  .catch((e) => {
    console.error('Error creating test plan:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
