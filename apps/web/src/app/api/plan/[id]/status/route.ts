import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/plan/[id]/status
 *
 * Checks if a specific plan is still the active plan for the user.
 * Returns the current status of the plan and whether there's a newer active plan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let clerkUserId: string;
    let _dbUserId: string;
    try {
      ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
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

    const { id: planId } = await params;

    // Find the plan being checked
    const checkedPlan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        userId: user.id,
      },
      select: {
        id: true,
        isActive: true,
        status: true,
        generatedAt: true,
      },
    });

    if (!checkedPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Find the current active plan for the user
    const activePlan = await prisma.mealPlan.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        generatedAt: true,
      },
    });

    // Determine if the checked plan is outdated
    const isReplaced = !checkedPlan.isActive;
    const hasNewerPlan = activePlan && activePlan.id !== planId;

    return NextResponse.json({
      planId: checkedPlan.id,
      isActive: checkedPlan.isActive,
      status: checkedPlan.status,
      isReplaced,
      hasNewerPlan,
      newerPlanId: hasNewerPlan ? activePlan.id : null,
      generatedAt: checkedPlan.generatedAt,
    });
  } catch (error) {
    logger.error('Error checking plan status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
