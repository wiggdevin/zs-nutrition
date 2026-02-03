import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // First, set all plans to inactive
    await prisma.mealPlan.updateMany({
      where: { isActive: true },
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
    console.error('Error setting active plan:', error);
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
