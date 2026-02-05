import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/plan/active
 *
 * Returns the user's currently active meal plan with full validated plan data.
 * Used by the /meal-plan page to display the generated plan.
 */
export async function GET() {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the active meal plan
    const activePlan = await prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { generatedAt: 'desc' },
      include: {
        profile: {
          select: {
            name: true,
            sex: true,
            age: true,
            goalType: true,
            activityLevel: true,
          },
        },
      },
    });

    if (!activePlan) {
      return NextResponse.json(
        { error: 'No active meal plan found', hasActivePlan: false },
        { status: 404 }
      );
    }

    // Parse the validated plan JSON
    let validatedPlan = null;
    try {
      validatedPlan =
        typeof activePlan.validatedPlan === 'string'
          ? JSON.parse(activePlan.validatedPlan)
          : activePlan.validatedPlan;
    } catch {
      logger.error('Failed to parse validatedPlan');
    }

    let metabolicProfile = null;
    try {
      metabolicProfile =
        typeof activePlan.metabolicProfile === 'string'
          ? JSON.parse(activePlan.metabolicProfile)
          : activePlan.metabolicProfile;
    } catch {
      logger.error('Failed to parse metabolicProfile');
    }

    return NextResponse.json({
      hasActivePlan: true,
      plan: {
        id: activePlan.id,
        dailyKcalTarget: activePlan.dailyKcalTarget,
        dailyProteinG: activePlan.dailyProteinG,
        dailyCarbsG: activePlan.dailyCarbsG,
        dailyFatG: activePlan.dailyFatG,
        trainingBonusKcal: activePlan.trainingBonusKcal,
        planDays: activePlan.planDays,
        startDate: activePlan.startDate,
        endDate: activePlan.endDate,
        qaScore: activePlan.qaScore,
        qaStatus: activePlan.qaStatus,
        status: activePlan.status,
        isActive: activePlan.isActive,
        generatedAt: activePlan.generatedAt,
        pdfUrl: activePlan.pdfUrl,
        validatedPlan,
        metabolicProfile,
        profile: activePlan.profile,
      },
    });
  } catch (error) {
    logger.error('Error fetching active plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
