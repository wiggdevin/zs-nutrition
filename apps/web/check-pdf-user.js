const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    where: { mealPlans: { some: { pdfUrl: { not: null } } } },
    select: { clerkUserId: true, email: true },
    take: 1
  });
  if (users.length > 0) {
    console.log(JSON.stringify(users[0]));
  } else {
    console.log('NONE');
  }
})();
