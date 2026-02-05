import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth";
import { logger } from "@/lib/safe-logger";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    let clerkUserId: string
    let dbUserId: string
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Account is deactivated' ? 403 : 401
      return NextResponse.json({ error: message }, { status })
    }

    // Look up the internal user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Verify the target plan belongs to this user
    const targetPlan = await prisma.mealPlan.findFirst({
      where: { id: planId, userId: user.id },
    });

    if (!targetPlan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Deactivate only this user's active plans
    await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    // Set the specified plan to active
    const plan = await prisma.mealPlan.update({
      where: { id: planId },
      data: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      message: `Plan ${planId} is now active`,
      plan: {
        id: plan.id,
        qaStatus: plan.qaStatus,
        qaScore: plan.qaScore,
      },
    });

  } catch (error) {
    logger.error('Error setting active plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to set active plan',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
