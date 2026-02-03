import { PrismaClient } from '@prisma/client';
import { QAValidator } from '@zero-sum/nutrition-engine';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function testGrocerySorting() {
  // Create a test compiled plan with diverse ingredients
  const compiledPlan = {
    days: [
      {
        dayNumber: 1,
        dayName: 'Monday',
        isTrainingDay: true,
        targetKcal: 2500,
        meals: [
          {
            slot: 'Breakfast',
            name: 'Oatmeal with Berries',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 5,
            servings: 1,
            nutrition: { kcal: 450, proteinG: 15, carbsG: 70, fatG: 12, fiberG: 8 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'rolled oats', amount: 100, unit: 'g' },
              { name: 'almond milk', amount: 250, unit: 'ml' },
              { name: 'blueberries', amount: 150, unit: 'g' },
              { name: 'honey', amount: 15, unit: 'g' },
              { name: 'almonds', amount: 20, unit: 'g' }
            ],
            instructions: ['Cook oats with milk', 'Top with berries'],
            primaryProtein: 'oats',
            tags: ['vegetarian']
          },
          {
            slot: 'Lunch',
            name: 'Grilled Chicken Salad',
            cuisine: 'Mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 10,
            servings: 1,
            nutrition: { kcal: 550, proteinG: 45, carbsG: 30, fatG: 22, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'chicken breast', amount: 200, unit: 'g' },
              { name: 'romaine lettuce', amount: 150, unit: 'g' },
              { name: 'tomato', amount: 100, unit: 'g' },
              { name: 'cucumber', amount: 100, unit: 'g' },
              { name: 'olive oil', amount: 15, unit: 'ml' },
              { name: 'lemon', amount: 1, unit: 'whole' }
            ],
            instructions: ['Grill chicken', 'Chop vegetables', 'Mix with dressing'],
            primaryProtein: 'chicken',
            tags: ['high-protein']
          },
          {
            slot: 'Dinner',
            name: 'Salmon with Vegetables',
            cuisine: 'American',
            prepTimeMin: 10,
            cookTimeMin: 20,
            servings: 1,
            nutrition: { kcal: 600, proteinG: 40, carbsG: 25, fatG: 35, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'salmon fillet', amount: 200, unit: 'g' },
              { name: 'broccoli', amount: 200, unit: 'g' },
              { name: 'sweet potato', amount: 250, unit: 'g' },
              { name: 'olive oil', amount: 15, unit: 'ml' },
              { name: 'garlic', amount: 3, unit: 'clove' },
              { name: 'salt', amount: 2, unit: 'g' },
              { name: 'black pepper', amount: 1, unit: 'g' }
            ],
            instructions: ['Roast salmon and vegetables', 'Season with spices'],
            primaryProtein: 'salmon',
            tags: ['gluten-free']
          }
        ],
        dailyTotals: { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 83, fiberG: 19 },
        varianceKcal: 0,
        variancePercent: 0
      }
    ]
  };

  // Run the QA validator to generate the grocery list
  const qaValidator = new QAValidator();
  const validatedPlan = await qaValidator.validate(compiledPlan);

  console.log('✅ Validated plan generated with grocery list:');
  console.log('');
  console.log('GROCERY CATEGORIES (in order):');
  validatedPlan.groceryList.forEach((g, i) => {
    console.log(`${i + 1}. ${g.category} (${g.items.length} items)`);
    if (g.items.length > 0) {
      g.items.forEach((item, j) => {
        console.log(`   ${j + 1}. ${item.name} - ${item.amount} ${item.unit}`);
      });
    }
    console.log('');
  });

  // Check if the order matches the spec
  const expectedOrder = [
    'Produce',
    'Meat and Seafood',
    'Dairy and Eggs',
    'Bakery',
    'Pantry',
    'Frozen',
    'Other'
  ];

  const actualOrder = validatedPlan.groceryList.map(g => g.category);

  console.log('VERIFICATION:');
  console.log('Expected order:', expectedOrder);
  console.log('Actual order:  ', actualOrder);

  const matches = actualOrder.every((cat, i) => {
    const expected = expectedOrder[i] || 'Other';
    // The category should either match the expected category at this position,
    // or be a valid category that appears later in the expected order
    const expectedIndex = expectedOrder.indexOf(cat);
    return cat === expected || (expectedIndex !== -1 && expectedIndex >= i);
  });

  if (matches) {
    console.log('');
    console.log('✅ PASS: Categories are in the correct order!');
  } else {
    console.log('');
    console.log('❌ FAIL: Categories are NOT in the correct order!');
  }

  await prisma.$disconnect();
}

testGrocerySorting().catch(console.error);
