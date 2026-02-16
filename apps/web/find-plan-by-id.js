/**
 * Find plan by ID prefix
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findPlan() {
  try {
    // Find the most recent active plan
    const activePlan = await prisma.mealPlan.findFirst({
      where: { isActive: true },
      orderBy: { generatedAt: 'desc' }
    });

    if (!activePlan) {
      console.log('❌ No active plan found');
      return;
    }

    console.log(`✅ Active Plan ID: ${activePlan.id}`);
    console.log(`   Generated: ${activePlan.generatedAt}`);

    // Also list all plans to see if there's another one
    const allPlans = await prisma.mealPlan.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        isActive: true,
        generatedAt: true
      }
    });

    console.log('\n📋 All recent plans:');
    allPlans.forEach(plan => {
      console.log(`  - ${plan.id} | Active: ${plan.isActive} | ${plan.generatedAt}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findPlan();
