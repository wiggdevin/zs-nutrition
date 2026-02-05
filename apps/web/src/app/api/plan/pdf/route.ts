import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/plan/pdf?planId=xxx
 * Returns the PDF URL for a given meal plan.
 * Used to verify that PDF was generated and URL is accessible.
 */
export async function GET(request: NextRequest) {
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

    const planId = request.nextUrl.searchParams.get('planId');

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let mealPlan;

    if (planId) {
      // Get specific plan (exclude soft-deleted)
      mealPlan = await prisma.mealPlan.findFirst({
        where: { id: planId, userId: user.id, deletedAt: null },
        select: {
          id: true,
          pdfUrl: true,
          status: true,
          isActive: true,
          generatedAt: true,
          dailyKcalTarget: true,
          dailyProteinG: true,
          dailyCarbsG: true,
          dailyFatG: true,
          planDays: true,
        },
      });
    } else {
      // Get the active plan (exclude soft-deleted)
      mealPlan = await prisma.mealPlan.findFirst({
        where: { userId: user.id, isActive: true, deletedAt: null },
        select: {
          id: true,
          pdfUrl: true,
          status: true,
          isActive: true,
          generatedAt: true,
          dailyKcalTarget: true,
          dailyProteinG: true,
          dailyCarbsG: true,
          dailyFatG: true,
          planDays: true,
        },
      });
    }

    if (!mealPlan) {
      return NextResponse.json({ error: 'No meal plan found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      planId: mealPlan.id,
      pdfUrl: mealPlan.pdfUrl,
      hasPdf: !!mealPlan.pdfUrl,
      status: mealPlan.status,
      isActive: mealPlan.isActive,
      generatedAt: mealPlan.generatedAt,
      macros: {
        dailyKcalTarget: mealPlan.dailyKcalTarget,
        dailyProteinG: mealPlan.dailyProteinG,
        dailyCarbsG: mealPlan.dailyCarbsG,
        dailyFatG: mealPlan.dailyFatG,
      },
    });
  } catch (error) {
    logger.error('[/api/plan/pdf] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
