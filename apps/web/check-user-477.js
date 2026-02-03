const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.findFirst({
    where: {
      onboarding: { completed: true },
      isActive: true
    },
    select: { id: true, email: true, clerkUserId: true }
  });
  if (user) {
    console.log('Found user:', user.email, 'ID:', user.id);
  } else {
    console.log('No users with completed onboarding found');
  }
  await prisma.$disconnect();
})();
