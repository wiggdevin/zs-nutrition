import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test 1: Basic connection - count users
    const userCount = await prisma.user.count()

    // Test 2: Count all models to verify tables exist
    const profileCount = await prisma.userProfile.count()
    const mealPlanCount = await prisma.mealPlan.count()
    const dailyLogCount = await prisma.dailyLog.count()
    const trackedMealCount = await prisma.trackedMeal.count()
    const onboardingCount = await prisma.onboardingState.count()
    const planJobCount = await prisma.planGenerationJob.count()
    const mealSwapCount = await prisma.mealSwap.count()
    const foodScanCount = await prisma.foodScan.count()

    return NextResponse.json({
      status: 'connected',
      database: 'ok',
      tables: {
        User: { count: userCount, exists: true },
        UserProfile: { count: profileCount, exists: true },
        MealPlan: { count: mealPlanCount, exists: true },
        DailyLog: { count: dailyLogCount, exists: true },
        TrackedMeal: { count: trackedMealCount, exists: true },
        OnboardingState: { count: onboardingCount, exists: true },
        PlanGenerationJob: { count: planJobCount, exists: true },
        MealSwap: { count: mealSwapCount, exists: true },
        FoodScan: { count: foodScanCount, exists: true },
      },
      totalTables: 9,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
