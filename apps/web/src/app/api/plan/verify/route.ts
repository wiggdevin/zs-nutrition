import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDevMode, getClerkUserId } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/plan/verify?planId=xxx
 *
 * Dev-only endpoint to verify MealPlan records in the database.
 * Blocked in production. In dev mode, scoped to the authenticated user's plans.
 */
export async function GET(request: NextRequest) {
  if (!isDevMode) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const planId = request.nextUrl.searchParams.get('planId');
  const jobId = request.nextUrl.searchParams.get('jobId');

  try {
    if (planId) {
      const plan = await prisma.mealPlan.findFirst({
        where: { id: planId, userId: user.id, deletedAt: null },
        include: {
          profile: {
            select: { name: true, sex: true, age: true, goalType: true },
          },
        },
      });

      if (!plan) {
        return NextResponse.json({ error: 'MealPlan not found' }, { status: 404 });
      }

      // validatedPlan and metabolicProfile are now Prisma Json types
      const validatedPlanObj = plan.validatedPlan as { days?: unknown[] } | null;
      const metabolicProfileObj = plan.metabolicProfile as Record<string, unknown> | null;
      return NextResponse.json({
        id: plan.id,
        userId: plan.userId,
        profileId: plan.profileId,
        profileInfo: plan.profile,
        validatedPlanHasDays: Array.isArray(validatedPlanObj?.days),
        validatedPlanDaysCount: validatedPlanObj?.days?.length || 0,
        metabolicProfileHasData:
          metabolicProfileObj !== null && Object.keys(metabolicProfileObj || {}).length > 0,
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
      });
    }

    if (jobId) {
      const job = await prisma.planGenerationJob.findFirst({
        where: { id: jobId, userId: user.id },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // result is now a Prisma Json type - no parsing needed
      return NextResponse.json({
        id: job.id,
        status: job.status,
        result: job.result,
        completedAt: job.completedAt,
      });
    }

    // Return latest plans for the current user only (exclude soft-deleted)
    const plans = await prisma.mealPlan.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { generatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        qaScore: true,
        qaStatus: true,
        status: true,
        isActive: true,
        planDays: true,
        generatedAt: true,
      },
    });

    return NextResponse.json({ plans, count: plans.length });
  } catch (error) {
    logger.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
