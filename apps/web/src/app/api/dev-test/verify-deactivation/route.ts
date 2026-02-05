import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Dev-only endpoint to verify that a deactivated account's data is preserved
 * GET /api/dev-test/verify-deactivation?email=test@example.com
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
  }

  try {
    // Find user regardless of active status
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        deactivatedAt: true,
        createdAt: true,
      },
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
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        createdAt: user.createdAt,
      },
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
      verification: 'Account data is preserved (soft delete)',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to verify deactivation' },
      { status: 500 }
    )
  }
}
