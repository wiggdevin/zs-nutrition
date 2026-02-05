import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { logger } from '@/lib/safe-logger'

/**
 * GET /api/account/status
 *
 * Returns the account status and data integrity info for the current user.
 * Used for verifying that deactivation preserves all data.
 */
export async function GET() {
  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user regardless of active status (for verification)
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Count all related records to verify data integrity
    const [
      profileCount,
      mealPlanCount,
      dailyLogCount,
      trackedMealCount,
      foodScanCount,
      planGenJobCount,
      onboardingState,
      mealSwapCount,
    ] = await Promise.all([
      prisma.userProfile.count({ where: { userId: user.id } }),
      prisma.mealPlan.count({ where: { userId: user.id } }),
      prisma.dailyLog.count({ where: { userId: user.id } }),
      prisma.trackedMeal.count({ where: { userId: user.id } }),
      prisma.foodScan.count({ where: { userId: user.id } }),
      prisma.planGenerationJob.count({ where: { userId: user.id } }),
      prisma.onboardingState.findUnique({ where: { userId: user.id } }),
      prisma.mealSwap.count({
        where: {
          mealPlan: { userId: user.id },
        },
      }),
    ])

    return NextResponse.json({
      userId: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.createdAt,
      dataCounts: {
        profiles: profileCount,
        mealPlans: mealPlanCount,
        dailyLogs: dailyLogCount,
        trackedMeals: trackedMealCount,
        foodScans: foodScanCount,
        planGenerationJobs: planGenJobCount,
        mealSwaps: mealSwapCount,
        hasOnboarding: !!onboardingState,
      },
    })
  } catch (error) {
    logger.error('Account status error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
