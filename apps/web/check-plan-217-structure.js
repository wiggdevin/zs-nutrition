const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
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

  console.log('=== Meal Plan Structure ===');
  console.log('First day:');
  console.log(JSON.stringify(validatedPlan.days[0], null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
