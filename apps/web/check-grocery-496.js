require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const plan = await prisma.mealPlan.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });

  if (plan && plan.validatedPlan) {
    const vp = JSON.parse(plan.validatedPlan);
    console.log('=== GROCERY LIST FROM DATABASE (Feature #496) ===');
    console.log(JSON.stringify(vp.groceryList, null, 2));
  }
  await prisma.$disconnect();
})();
