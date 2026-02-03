const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

const testPlanData = {
  days: [
    {
      dayNumber: 1,
      dayName: 'Monday',
      isTrainingDay: true,
      targetKcal: 2200,
      meals: [
        {
          slot: 'breakfast',
          name: 'Greek Yogurt Parfait with Berries',
          cuisine: 'American',
          prepTimeMin: 10,
          cookTimeMin: 0,
          nutrition: { kcal: 450, proteinG: 30, carbsG: 45, fatG: 15 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'lunch',
          name: 'Grilled Chicken Caesar Salad',
          cuisine: 'American',
          prepTimeMin: 15,
          cookTimeMin: 20,
          nutrition: { kcal: 650, proteinG: 45, carbsG: 30, fatG: 35 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'dinner',
          name: 'Baked Salmon with Roasted Vegetables',
          cuisine: 'Mediterranean',
          prepTimeMin: 15,
          cookTimeMin: 25,
          nutrition: { kcal: 850, proteinG: 55, carbsG: 45, fatG: 40 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'snack',
          name: 'Apple with Almond Butter',
          cuisine: 'American',
          prepTimeMin: 5,
          cookTimeMin: 0,
          nutrition: { kcal: 250, proteinG: 5, carbsG: 30, fatG: 12 },
          confidenceLevel: 'ai_estimated'
        }
      ]
    },
    {
      dayNumber: 2,
      dayName: 'Tuesday',
      isTrainingDay: false,
      targetKcal: 2000,
      meals: [
        {
          slot: 'breakfast',
          name: 'Overnight Oats with Banana',
          cuisine: 'American',
          prepTimeMin: 5,
          cookTimeMin: 0,
          nutrition: { kcal: 400, proteinG: 15, carbsG: 65, fatG: 12 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'lunch',
          name: 'Turkey Sandwich on Whole Grain',
          cuisine: 'American',
          prepTimeMin: 10,
          cookTimeMin: 0,
          nutrition: { kcal: 550, proteinG: 35, carbsG: 50, fatG: 20 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'dinner',
          name: 'Beef Stir Fry with Brown Rice',
          cuisine: 'Asian',
          prepTimeMin: 20,
          cookTimeMin: 15,
          nutrition: { kcal: 800, proteinG: 45, carbsG: 70, fatG: 30 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'snack',
          name: 'Mixed Nuts',
          cuisine: 'American',
          prepTimeMin: 0,
          cookTimeMin: 0,
          nutrition: { kcal: 250, proteinG: 8, carbsG: 10, fatG: 20 },
          confidenceLevel: 'verified'
        }
      ]
    },
    {
      dayNumber: 3,
      dayName: 'Wednesday',
      isTrainingDay: true,
      targetKcal: 2200,
      meals: [
        {
          slot: 'breakfast',
          name: 'Avocado Toast with Eggs',
          cuisine: 'American',
          prepTimeMin: 10,
          cookTimeMin: 10,
          nutrition: { kcal: 500, proteinG: 22, carbsG: 35, fatG: 28 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'lunch',
          name: 'Quinoa Buddha Bowl',
          cuisine: 'Asian',
          prepTimeMin: 20,
          cookTimeMin: 15,
          nutrition: { kcal: 700, proteinG: 30, carbsG: 75, fatG: 28 },
          confidenceLevel: 'ai_estimated'
        },
        {
          slot: 'dinner',
          name: 'Grilled Steak with Asparagus',
          cuisine: 'American',
          prepTimeMin: 15,
          cookTimeMin: 20,
          nutrition: { kcal: 900, proteinG: 60, carbsG: 40, fatG: 45 },
          confidenceLevel: 'verified'
        },
        {
          slot: 'snack',
          name: 'Protein Smoothie',
          cuisine: 'American',
          prepTimeMin: 5,
          cookTimeMin: 0,
          nutrition: { kcal: 300, proteinG: 25, carbsG: 35, fatG: 8 },
          confidenceLevel: 'verified'
        }
      ]
    }
  ],
  groceryList: [
    {
      category: 'Produce',
      items: [
        { name: 'Greek Yogurt', amount: 32, unit: 'oz' },
        { name: 'Berries', amount: 2, unit: 'cups' },
        { name: 'Banana', amount: 3, unit: '' }
      ]
    },
    {
      category: 'Meat and Seafood',
      items: [
        { name: 'Chicken Breast', amount: 1, unit: 'lb' },
        { name: 'Salmon Fillet', amount: 1, unit: 'lb' }
      ]
    }
  ],
  qa: { status: 'PASS', score: 92, iterations: 1 }
};

async function main() {
  // Get the active meal plan
  const activePlan = await prisma.mealPlan.findFirst({
    where: { status: 'active' }
  });

  if (!activePlan) {
    console.log('No active meal plan found!');
    process.exit(1);
  }

  console.log('Found active meal plan:', activePlan.id);

  // Update using validatedPlan as String (JSON stringified)
  const jsonString = JSON.stringify(testPlanData);
  await prisma.mealPlan.update({
    where: { id: activePlan.id },
    data: {
      validatedPlan: jsonString
    }
  });

  console.log('Updated meal plan with test data');

  // Verify
  const verify = await prisma.mealPlan.findUnique({
    where: { id: activePlan.id }
  });
  const parsed = JSON.parse(verify.validatedPlan);
  console.log('Has days:', parsed.days?.length || 0);
  console.log('Day 1 name:', parsed.days?.[0]?.dayName || 'N/A');
  console.log('Day 1 meals:', parsed.days?.[0]?.meals?.length || 0);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
