import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the user
  const user = await prisma.user.findFirst({
    where: {
      profiles: {
        some: {
          name: { contains: '470' }
        }
      }
    }
  });

  if (!user) {
    console.log('No user found');
    return;
  }

  console.log('User ID:', user.id);
  console.log('Clerk User ID:', user.clerkUserId);

  // Check for active meal plan
  const activePlan = await prisma.mealPlan.findFirst({
    where: {
      userId: user.id,
      isActive: true,
      status: 'active'
    },
    orderBy: { generatedAt: 'desc' }
  });

  if (activePlan) {
    console.log('\nActive meal plan found:');
    console.log('  Plan ID:', activePlan.id);
    console.log('  Daily Kcal Target:', activePlan.dailyKcalTarget);
    console.log('  Training Bonus Kcal:', activePlan.trainingBonusKcal);
    console.log('  Total Kcal:', (activePlan.dailyKcalTarget || 0) + (activePlan.trainingBonusKcal || 0));
  } else {
    console.log('\nNo active meal plan found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
