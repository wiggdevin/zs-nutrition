const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  // Get the meal plan
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      user: {
        email: 'feature-217-test@zsmac.dev'
      }
    }
  });

  if (!mealPlan) {
    console.log('No meal plan found');
    process.exit(1);
  }

  const validatedPlan = JSON.parse(mealPlan.validatedPlan);

  // Transform estimatedNutrition to nutrition for all meals
  for (const day of validatedPlan.days) {
    for (const meal of day.meals) {
      if (meal.estimatedNutrition && !meal.nutrition) {
        meal.nutrition = meal.estimatedNutrition;
        delete meal.estimatedNutrition;
      }
    }
  }

  // Update the meal plan
  await prisma.mealPlan.update({
    where: { id: mealPlan.id },
    data: {
      validatedPlan: JSON.stringify(validatedPlan)
    }
  });

  console.log('✓ Fixed meal plan nutrition structure');
  console.log('First day meals now have nutrition field:');
  console.log(JSON.stringify(validatedPlan.days[0].meals[0], null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
