/**
 * Test Feature #457: DailyLog unique constraint works
 * This script tests that only one DailyLog exists per user per date
 */

// Set DATABASE_URL directly
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDailyLogUniqueConstraint() {
  console.log('=== Feature #457: DailyLog Unique Constraint Test ===\n');

  try {
    // Step 1: Find or create a test user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId: 'test-clerk-457',
          email: 'test-457@example.com',
        },
      });
      console.log('✓ Created test user:', user.id);
    } else {
      console.log('✓ Using existing user:', user.id);
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 2: Clean up any existing DailyLog for this user and date
    const existingLogs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: today,
      },
    });
    console.log(`\nStep 0: Cleanup - Found ${existingLogs.length} existing DailyLog(s) for today`);
    for (const log of existingLogs) {
      await prisma.dailyLog.delete({ where: { id: log.id } });
      console.log('  - Deleted existing DailyLog:', log.id);
    }

    // Step 3: Log first meal - should CREATE DailyLog
    console.log('\n--- Step 1: Log first meal for today ---');
    const firstMealResult = await prisma.$transaction(async (tx) => {
      // Create tracked meal
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          loggedDate: today,
          mealName: 'TEST_MEAL_1_FEATURE_457',
          portion: 1.0,
          kcal: 500,
          proteinG: 30,
          carbsG: 50,
          fatG: 15,
          source: 'manual',
        },
      });
      console.log('  ✓ Created TrackedMeal:', trackedMeal.id);

      // Upsert DailyLog
      const dailyLog = await tx.dailyLog.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
        create: {
          userId: user.id,
          date: today,
          targetKcal: 2000,
          targetProteinG: 150,
          targetCarbsG: 200,
          targetFatG: 65,
          actualKcal: 500,
          actualProteinG: 30,
          actualCarbsG: 50,
          actualFatG: 15,
        },
        update: {
          actualKcal: { increment: 500 },
          actualProteinG: { increment: 30 },
          actualCarbsG: { increment: 50 },
          actualFatG: { increment: 15 },
        },
      });
      console.log('  ✓ Upserted DailyLog:', dailyLog.id, '(CREATE path)');
      console.log('    - Actual Kcal:', dailyLog.actualKcal);

      return { trackedMeal, dailyLog };
    });

    // Step 4: Verify only ONE DailyLog exists
    console.log('\n--- Step 2: Verify DailyLog created ---');
    const logsAfterFirst = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: today,
      },
    });
    console.log('  DailyLog count after first meal:', logsAfterFirst.length);
    if (logsAfterFirst.length === 1) {
      console.log('  ✓ VERIFIED: Exactly ONE DailyLog exists');
    } else {
      console.log('  ✗ FAILED: Expected 1 DailyLog, found', logsAfterFirst.length);
      return false;
    }

    // Step 5: Log second meal - should UPDATE existing DailyLog
    console.log('\n--- Step 3: Log second meal ---');
    const secondMealResult = await prisma.$transaction(async (tx) => {
      // Create tracked meal
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          loggedDate: today,
          mealName: 'TEST_MEAL_2_FEATURE_457',
          portion: 1.0,
          kcal: 300,
          proteinG: 20,
          carbsG: 30,
          fatG: 10,
          source: 'manual',
        },
      });
      console.log('  ✓ Created TrackedMeal:', trackedMeal.id);

      // Upsert DailyLog (should UPDATE this time)
      const dailyLog = await tx.dailyLog.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
        create: {
          userId: user.id,
          date: today,
          targetKcal: 2000,
          targetProteinG: 150,
          targetCarbsG: 200,
          targetFatG: 65,
          actualKcal: 300,
          actualProteinG: 20,
          actualCarbsG: 30,
          actualFatG: 10,
        },
        update: {
          actualKcal: { increment: 300 },
          actualProteinG: { increment: 20 },
          actualCarbsG: { increment: 30 },
          actualFatG: { increment: 10 },
        },
      });
      console.log('  ✓ Upserted DailyLog:', dailyLog.id, '(UPDATE path)');
      console.log('    - Actual Kcal:', dailyLog.actualKcal);
      console.log('    - Expected Kcal:', 500 + 300, '(500 from first meal + 300 from second)');

      return { trackedMeal, dailyLog };
    });

    // Step 6: Verify still only ONE DailyLog exists (not duplicated)
    console.log('\n--- Step 4: Verify same DailyLog updated (not new record) ---');
    const logsAfterSecond = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: today,
      },
    });
    console.log('  DailyLog count after second meal:', logsAfterSecond.length);
    if (logsAfterSecond.length === 1) {
      console.log('  ✓ VERIFIED: Still exactly ONE DailyLog (not duplicated)');
    } else {
      console.log('  ✗ FAILED: Expected 1 DailyLog, found', logsAfterSecond.length);
      return false;
    }

    // Verify it's the SAME DailyLog ID
    if (logsAfterFirst[0].id === logsAfterSecond[0].id) {
      console.log('  ✓ VERIFIED: Same DailyLog ID (', logsAfterFirst[0].id, ') was updated');
    } else {
      console.log('  ✗ FAILED: Different DailyLog IDs!');
      console.log('    First:', logsAfterFirst[0].id);
      console.log('    Second:', logsAfterSecond[0].id);
      return false;
    }

    // Step 7: Verify the DailyLog was updated correctly
    const finalDailyLog = logsAfterSecond[0];
    console.log('\n--- Step 5: Verify DailyLog values ---');
    console.log('  Final DailyLog ID:', finalDailyLog.id);
    console.log('  Final Actual Kcal:', finalDailyLog.actualKcal);
    console.log('  Expected Kcal:', 500 + 300, '(sum of both meals)');
    console.log('  Final Actual Protein:', finalDailyLog.actualProteinG, 'g');
    console.log('  Expected Protein:', 30 + 20, 'g');

    if (finalDailyLog.actualKcal === 800 &&
        finalDailyLog.actualProteinG === 50 &&
        finalDailyLog.actualCarbsG === 80 &&
        finalDailyLog.actualFatG === 25) {
      console.log('  ✓ VERIFIED: All values match expected totals');
    } else {
      console.log('  ✗ FAILED: Values do not match');
      console.log('    Expected: kcal=800, protein=50, carbs=80, fat=25');
      console.log('    Actual: kcal=' + finalDailyLog.actualKcal +
                  ', protein=' + finalDailyLog.actualProteinG +
                  ', carbs=' + finalDailyLog.actualCarbsG +
                  ', fat=' + finalDailyLog.actualFatG);
      return false;
    }

    // Step 8: Verify unique constraint prevents duplicate
    console.log('\n--- Step 6: Attempt to create duplicate DailyLog (should fail) ---');
    try {
      await prisma.dailyLog.create({
        data: {
          userId: user.id,
          date: today,
          targetKcal: 2000,
          actualKcal: 100,
        },
      });
      console.log('  ✗ FAILED: Unique constraint did NOT prevent duplicate');
      return false;
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('  ✓ VERIFIED: Unique constraint prevents duplicate');
        console.log('    Error code:', error.code);
        console.log('    Constraint:', error.meta?.target);
      } else {
        console.log('  ? Unexpected error:', error.message);
        console.log('    Error code:', error.code);
        // P2002 is the Prisma error code for unique constraint violations
        if (error.code === 'P2002') {
          console.log('  ✓ This is actually the unique constraint error (P2002)');
        } else {
          return false;
        }
      }
    }

    // Step 9: Check database for userId+date combination
    console.log('\n--- Step 7: Check database for userId+date combination ---');
    const allUserLogs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        date: 'desc',
      },
    });
    console.log('  All DailyLogs for user:', allUserLogs.length);
    for (const log of allUserLogs) {
      console.log('    - Date:', log.date.toISOString().split('T')[0], 'ID:', log.id);
    }

    // Count logs for today
    const todayLogsCount = await prisma.dailyLog.count({
      where: {
        userId: user.id,
        date: today,
      },
    });
    console.log('  Count of DailyLogs for today:', todayLogsCount);
    if (todayLogsCount === 1) {
      console.log('  ✓ VERIFIED: Exactly one DailyLog record per date');
    } else {
      console.log('  ✗ FAILED: Expected exactly 1 DailyLog, found', todayLogsCount);
      return false;
    }

    // Cleanup test data
    console.log('\n--- Cleanup: Removing test data ---');
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        loggedDate: today,
        mealName: { in: ['TEST_MEAL_1_FEATURE_457', 'TEST_MEAL_2_FEATURE_457'] },
      },
    });
    await prisma.dailyLog.deleteMany({
      where: {
        userId: user.id,
        date: today,
      },
    });
    console.log('  ✓ Test data cleaned up');

    console.log('\n=== ALL TESTS PASSED ✓ ===');
    console.log('\nFeature #457 Summary:');
    console.log('  ✓ Log first meal created DailyLog');
    console.log('  ✓ Log second meal updated same DailyLog (not duplicated)');
    console.log('  ✓ Database shows exactly one DailyLog per userId+date');
    console.log('  ✓ Unique constraint prevents duplicate creation');
    console.log('  ✓ All nutritional values accumulated correctly');

    return true;

  } catch (error) {
    console.error('\n✗ TEST FAILED WITH ERROR:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDailyLogUniqueConstraint()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
