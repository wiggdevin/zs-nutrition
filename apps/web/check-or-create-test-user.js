const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Try to find an existing test user
  let user = await prisma.user.findFirst({
    where: {
      email: { contains: 'test' }
    }
  });

  if (user) {
    console.log('Found existing test user:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Clerk User ID:', user.clerkUserId);
  } else {
    // Create a new test user
    const testUserId = 'user_test_' + Date.now();
    user = await prisma.user.create({
      data: {
        clerkUserId: testUserId,
        email: 'test@example.com',
        isActive: true
      }
    });
    console.log('Created new test user:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Clerk User ID:', user.clerkUserId);
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error);
