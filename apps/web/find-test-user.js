/**
 * Find test users in the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
      },
      take: 10,
    });

    console.log('📋 Users in database:');
    users.forEach((user) => {
      console.log(`  - User ID: ${user.id} | Clerk ID: ${user.clerkUserId}`);
    });

    // Find active meal plans
    const activePlans = await prisma.mealPlan.findMany({
      where: { isActive: true },
      include: {
        profile: {
          select: {
            name: true,
            clerkUserId: true,
          },
        },
      },
      orderBy: {
        generatedAt: 'desc',
      },
      take: 5,
    });

    console.log('\n📋 Active meal plans:');
    activePlans.forEach((plan) => {
      console.log(
        `  - Plan ID: ${plan.id} | User: ${plan.profile?.name || plan.profile?.clerkUserId}`
      );
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUsers();
