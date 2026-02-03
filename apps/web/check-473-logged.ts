import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkLoggedFood() {
  // Get the user
  const user = await prisma.user.findUnique({
    where: { email: 'feature-473-test@example.com' }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ User found:', user.id);

  // Get today's logged entries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const entries = await prisma.trackedMeal.findMany({
    where: {
      userId: user.id,
      loggedDate: {
        gte: today,
        lt: tomorrow
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  console.log('\n=== RECENT FOOD ENTRIES ===');
  entries.forEach((entry, idx) => {
    console.log(`\n${idx + 1}. ${entry.mealName}`);
    console.log(`   Portion: ${entry.portion}`);
    console.log(`   Calories: ${entry.kcal} kcal`);
    console.log(`   Protein: ${entry.proteinG}g | Carbs: ${entry.carbsG}g | Fat: ${entry.fatG}g`);
    if (entry.fiberG !== null) {
      console.log(`   Fiber: ${entry.fiberG}g`);
    }
    console.log(`   Source: ${entry.source}`);
    console.log(`   Logged at: ${entry.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
}

checkLoggedFood().catch(console.error);
