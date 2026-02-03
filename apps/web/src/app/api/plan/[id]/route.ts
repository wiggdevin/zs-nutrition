import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

/**
 * GET /api/plan/[id]
 *
 * Returns a specific meal plan by ID, but ONLY if it belongs to the authenticated user.
 * This prevents users from accessing other users' meal plans via URL manipulation.
 *
 * Security: Filters by both plan ID and userId to ensure data isolation.
 * Returns 404 (not 403) to avoid leaking information about plan existence.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to access this resource.' },
        { status: 401 }
      );
    }

    const { id: planId } = await params;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found.' },
        { status: 401 }
      );
    }

    // Find the plan by ID, but ONLY if it belongs to the authenticated user
    // This is the critical security check - we filter by BOTH id AND userId
    const plan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        userId: user.id, // <-- Security: ensures user can only access their own plans
      },
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

    if (!plan) {
      // Return 404 for both "plan doesn't exist" and "plan belongs to another user"
      // This prevents information leakage about other users' plans
      return NextResponse.json(
        { error: 'Not found', message: 'Meal plan not found.' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    let validatedPlan = null;
    try {
      validatedPlan = typeof plan.validatedPlan === 'string'
        ? JSON.parse(plan.validatedPlan)
        : plan.validatedPlan;
    } catch {
      // empty
    }

    let metabolicProfile = null;
    try {
      metabolicProfile = typeof plan.metabolicProfile === 'string'
        ? JSON.parse(plan.metabolicProfile)
        : plan.metabolicProfile;
    } catch {
      // empty
    }

    return NextResponse.json({
      plan: {
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
        validatedPlan,
        metabolicProfile,
        profile: plan.profile,
      },
    });
  } catch (error) {
    safeLogError('Error fetching plan by ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
