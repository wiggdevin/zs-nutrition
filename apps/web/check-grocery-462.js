const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function check() {
  // Try the seeded plan
  const planId = '426ac5ae-8e35-4d8f-b308-4c8e4586bc1a';
  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    select: { id: true, isActive: true, validatedPlan: true }
  });
  if (plan) {
    console.log('Plan found:', plan.id, 'Active:', plan.isActive);
    const grocery = plan.validatedPlan?.groceryList;
    if (grocery && grocery.length > 0) {
      console.log('Grocery categories:');
      grocery.forEach((g, i) => {
        console.log(`  ${i+1}. ${g.category} (${g.items?.length || 0} items)`);
        if (g.items && g.items.length > 0) {
          g.items.forEach((item, j) => {
            console.log(`     ${j+1}. ${item.name} - ${item.amount || 0} ${item.unit || ''}`);
          });
        }
      });
    } else {
      console.log('No grocery list in plan');
    }
  } else {
    console.log('Plan not found');
  }
  await prisma.$disconnect();
}
check().catch(console.error);
