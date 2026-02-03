import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

/**
 * GET /api/plan/[id]/status
 *
 * Checks if a specific plan is still the active plan for the user.
 * Returns the current status of the plan and whether there's a newer active plan.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const planId = params.id;

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
    safeLogError('Error checking plan status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
