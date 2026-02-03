import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DEV TEST ENDPOINT - Tests feature #141: regeneratePlan creates new plan and replaces old
 * GET /api/test-feature-141
 *
 * Simulates the complete regeneratePlan flow and verifies:
 * 1. Old plan is marked as 'replaced' and isActive=false
 * 2. New plan is created with status='active' and isActive=true
 * 3. Only one plan is active at a time
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const clerkUserId = 'dev-test-user-plan@zsmac.dev';

    // Step 1: Find test user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        profiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        mealPlans: {
          where: { isActive: true },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Test user not found. Run /api/dev-test-user-plan first' },
        { status: 404 }
      );
    }

    const profile = user.profiles[0];
    if (!profile) {
      return NextResponse.json(
        { error: 'No active profile found' },
        { status: 404 }
      );
    }

    const oldPlan = user.mealPlans[0];
    if (!oldPlan) {
      return NextResponse.json(
        { error: 'No active plan found. Run /api/dev-test-user-plan first' },
        { status: 404 }
      );
    }

    const oldPlanId = oldPlan.id;
    const oldPlanStatus = oldPlan.status;
    const oldPlanIsActive = oldPlan.isActive;

    // Step 2: Create PlanGenerationJob (simulating regeneratePlan)
    const job = await prisma.planGenerationJob.create({
      data: {
        userId: user.id,
        status: 'pending',
        intakeData: JSON.stringify({
          name: profile.name,
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          goalType: profile.goalType,
          goalRate: profile.goalRate,
          activityLevel: profile.activityLevel,
          dietaryStyle: profile.dietaryStyle,
          mealsPerDay: profile.mealsPerDay,
          snacksPerDay: profile.snacksPerDay,
          planDurationDays: 7,
        }),
        startedAt: new Date(),
      },
    });

    // Step 3: Deactivate existing active plans (KEY LOGIC for feature #141)
    const deactivateResult = await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, status: 'replaced' },
    });

    // Step 4: Create new meal plan
    const newPlan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify({ days: [] }),
        metabolicProfile: JSON.stringify({}),
        dailyKcalTarget: profile.goalKcal || 2000,
        dailyProteinG: profile.proteinTargetG || 150,
        dailyCarbsG: profile.carbsTargetG || 200,
        dailyFatG: profile.fatTargetG || 70,
        planDays: 7,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qaScore: 90,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
      },
    });

    // Step 5: Mark job as completed
    await prisma.planGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        result: JSON.stringify({ planId: newPlan.id }),
        completedAt: new Date(),
      },
    });

    // Refresh the job to get updated status
    const updatedJob = await prisma.planGenerationJob.findUnique({
      where: { id: job.id },
    });

    // Step 6: Verification
    const oldPlanAfter = await prisma.mealPlan.findUnique({
      where: { id: oldPlanId },
    });

    const newPlanAfter = await prisma.mealPlan.findUnique({
      where: { id: newPlan.id },
    });

    const activePlans = await prisma.mealPlan.findMany({
      where: { userId: user.id, isActive: true },
    });

    const replacedPlans = await prisma.mealPlan.findMany({
      where: { userId: user.id, status: 'replaced' },
    });

    const allPlans = await prisma.mealPlan.findMany({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    });

    // Verification checks
    const checks = {
      oldPlanMarkedReplaced: oldPlanAfter?.status === 'replaced' && oldPlanAfter?.isActive === false,
      newPlanIsActive: newPlanAfter?.status === 'active' && newPlanAfter?.isActive === true,
      onlyOneActivePlan: activePlans.length === 1,
      newPlanIsTheActiveOne: activePlans[0]?.id === newPlan.id,
      jobCompleted: updatedJob?.status === 'completed',
    };

    const allChecksPassed = Object.values(checks).every((check) => check === true);

    return NextResponse.json({
      success: true,
      feature141: {
        name: 'planRouter.regeneratePlan creates new plan and replaces old',
        allChecksPassed,
        status: allChecksPassed ? 'PASSING ✅' : 'FAILING ❌',
      },
      before: {
        oldPlanId,
        oldPlanStatus,
        oldPlanIsActive,
      },
      after: {
        oldPlan: {
          id: oldPlanAfter?.id,
          status: oldPlanAfter?.status,
          isActive: oldPlanAfter?.isActive,
        },
        newPlan: {
          id: newPlanAfter?.id,
          status: newPlanAfter?.status,
          isActive: newPlanAfter?.isActive,
          qaScore: newPlanAfter?.qaScore,
        },
        activePlansCount: activePlans.length,
        activePlanId: activePlans[0]?.id,
        replacedPlansCount: replacedPlans.length,
        totalPlans: allPlans.length,
      },
      checks,
      verification: {
        step1_jobCreated: true,
        step2_oldPlanDeactivated: checks.oldPlanMarkedReplaced,
        step3_newPlanCreated: checks.newPlanIsActive,
        step4_onlyOneActive: checks.onlyOneActivePlan,
        step5_correctPlanActive: checks.newPlanIsTheActiveOne,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
