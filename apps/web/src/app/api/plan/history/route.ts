import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

/**
 * GET /api/plan/history
 *
 * Returns all meal plans for the current user, ordered by generatedAt descending.
 * Includes both active and historical plans with status information.
 */
export async function GET() {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find all meal plans for the user, ordered by most recent first
    const plans = await prisma.mealPlan.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        trainingBonusKcal: true,
        planDays: true,
        startDate: true,
        endDate: true,
        qaScore: true,
        qaStatus: true,
        status: true,
        isActive: true,
        generatedAt: true,
        pdfUrl: true,
        profile: {
          select: {
            name: true,
            goalType: true,
          },
        },
      },
    });

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        trainingBonusKcal: plan.trainingBonusKcal,
        planDays: plan.planDays,
        startDate: plan.startDate,
        endDate: plan.endDate,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        status: plan.status,
        isActive: plan.isActive,
        generatedAt: plan.generatedAt,
        pdfUrl: plan.pdfUrl,
        profile: plan.profile,
      })),
    });
  } catch (error) {
    safeLogError('Error fetching plan history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
