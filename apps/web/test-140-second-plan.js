/**
 * Create a second plan to test deactivation
 */

require('dotenv').config({ path: '.env.local' });
process.env.DATABASE_URL = "file:/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/prisma/dev.db";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSecondPlan() {
  try {
    const email = 'test-feature-140@example.com';
    const timestamp = Date.now();

    // Get user
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get active profile
    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get current active plan
    const currentActivePlan = await prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        status: 'active',
      },
    });

    if (!currentActivePlan) {
      console.log('ℹ️ No current active plan found');
    } else {
      console.log('✅ Current active plan:', currentActivePlan.id);
      console.log('   Status:', currentActivePlan.status);
      console.log('   IsActive:', currentActivePlan.isActive);
    }

    // Create new validated plan
    const validatedPlan = {
      days: [
        {
          dayNumber: 1,
          date: new Date().toISOString().split('T')[0],
          meals: [
            {
              slot: 'breakfast',
              name: `NEW Test Breakfast 140-${timestamp}`,
              cuisine: 'american',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: {
                kcal: 600,
                protein: 35,
                carbs: 60,
                fat: 18,
              },
            },
          ],
        },
      ],
    };

    const metabolicProfile = {
      bmrKcal: 1850,
      tdeeKcal: 2550,
      goalKcal: 2100,
      proteinTargetG: 160,
      carbsTargetG: 210,
      fatTargetG: 75,
    };

    // Mark old plan as inactive (simulating completeJob behavior)
    if (currentActivePlan) {
      await prisma.mealPlan.update({
        where: { id: currentActivePlan.id },
        data: { isActive: false, status: 'replaced' },
      });
      console.log('✅ Old plan marked as inactive:', currentActivePlan.id);
    }

    // Create new active meal plan
    const newPlan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify(validatedPlan),
        metabolicProfile: JSON.stringify(metabolicProfile),
        dailyKcalTarget: 2100,
        dailyProteinG: 160,
        dailyCarbsG: 210,
        dailyFatG: 75,
        trainingBonusKcal: 0,
        planDays: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qaScore: 92,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
      },
    });

    console.log('✅ Created NEW active meal plan:', newPlan.id);
    console.log('\n===========================================');
    console.log('VERIFICATION');
    console.log('===========================================');

    // Verify old plan is inactive
    if (currentActivePlan) {
      const oldPlanCheck = await prisma.mealPlan.findUnique({
        where: { id: currentActivePlan.id },
      });
      console.log('Old plan status:', oldPlanCheck?.status);
      console.log('Old plan isActive:', oldPlanCheck?.isActive);
    }

    // Verify new plan is active
    const newPlanCheck = await prisma.mealPlan.findUnique({
      where: { id: newPlan.id },
    });
    console.log('New plan status:', newPlanCheck?.status);
    console.log('New plan isActive:', newPlanCheck?.isActive);

    // Test getActivePlan (simulating the API call)
    const activePlan = await prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        status: 'active',
      },
      orderBy: { generatedAt: 'desc' },
    });

    console.log('\ngetActivePlan result:');
    console.log('  Plan ID:', activePlan?.id);
    console.log('  Matches new plan?', activePlan?.id === newPlan.id);

    if (activePlan?.id === newPlan.id) {
      console.log('\n✅ SUCCESS: getActivePlan returns the new plan!');
    } else {
      console.log('\n❌ FAIL: getActivePlan did not return the new plan');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSecondPlan();
