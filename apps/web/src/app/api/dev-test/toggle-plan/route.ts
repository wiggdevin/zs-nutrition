import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

/**
 * POST /api/dev-test/toggle-plan
 * Toggle active meal plan on/off for testing empty states.
 * DEV ONLY - not for production use.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const setActive = body.active;

    // Find all meal plans for this user
    const plans = await prisma.mealPlan.findMany({
      where: { userId: user.id },
      select: { id: true, isActive: true },
    });

    if (plans.length === 0) {
      return NextResponse.json({ message: 'No plans found', hasActivePlan: false });
    }

    // Toggle all plans
    await prisma.mealPlan.updateMany({
      where: { userId: user.id },
      data: { isActive: setActive === true },
    });

    return NextResponse.json({
      message: `Plans set to active=${setActive}`,
      hasActivePlan: setActive,
      plansUpdated: plans.length,
    });
  } catch (error) {
    safeLogError('Error toggling plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
