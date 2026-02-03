const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMeals() {
  const meals = await prisma.trackedMeal.findMany({
    where: { mealName: { startsWith: 'PERF_TEST_TODAY' } },
    orderBy: { loggedDate: 'desc' },
    take: 10
  });

  console.log('Test meals with mealSlot:');
  meals.forEach(meal => {
    console.log(`  - ${meal.mealSlot}: ${meal.mealName} (source: ${meal.source})`);
  });

  await prisma.$disconnect();
}

checkMeals().catch(console.error);
