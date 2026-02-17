import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/plan/versions
 *
 * Returns all plan versions for the current user, ordered by version DESC.
 * Excludes soft-deleted plans.
 */
export async function GET() {
  try {
    let clerkUserId: string;
    try {
      ({ clerkUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plans = await prisma.mealPlan.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        generatedAt: true,
        qaScore: true,
        qaStatus: true,
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        status: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      versions: plans.map((plan) => ({
        id: plan.id,
        version: plan.version,
        generatedAt: plan.generatedAt,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        status: plan.status,
        isActive: plan.isActive,
      })),
    });
  } catch (error) {
    logger.error('Error fetching plan versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
