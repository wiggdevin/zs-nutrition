const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db'
    }
  }
});

async function main() {
  const userId = '8b1b3751-5d1d-46a5-bdea-b7c2efb950ba';

  // Create or update onboarding record
  const onboarding = await prisma.onboardingState.upsert({
    where: { userId },
    create: {
      userId,
      currentStep: 6,
      completed: true
    },
    update: {
      currentStep: 6,
      completed: true
    }
  });

  console.log('Onboarding marked as completed');
  console.log('Onboarding ID:', onboarding.id);
  console.log('Completed:', onboarding.completed);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
