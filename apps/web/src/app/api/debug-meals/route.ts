import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'

export async function GET() {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'dev@zsnutrition.test' },
    })

    if (!user) {
      return NextResponse.json({ error: 'Dev user not found' }, { status: 404 })
    }

    // Get all tracked meals for this user
    const allMeals = await prisma.trackedMeal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Get all plans
    const allPlans = await prisma.mealPlan.findMany({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      totalTrackedMeals: allMeals.length,
      totalPlans: allPlans.length,
      meals: allMeals.map(meal => ({
        id: meal.id,
        mealName: meal.mealName,
        kcal: meal.kcal,
        proteinG: meal.proteinG,
        loggedAt: meal.createdAt,
        mealPlanId: meal.mealPlanId,
      })),
      plans: allPlans.map(plan => ({
        id: plan.id,
        status: plan.status,
        isActive: plan.isActive,
        generatedAt: plan.generatedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
