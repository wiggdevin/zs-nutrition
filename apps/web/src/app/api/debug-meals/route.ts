import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  if (!isDevMode) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    // Get the dev user ID from cookie
    const cookieStore = await cookies()
    const devUserId = cookieStore.get('dev-user-id')?.value

    if (!devUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get all tracked meals for this user that contain "Feature 243"
    const allMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: devUserId,
        mealName: { contains: 'Feature 243' },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      devUserId,
      totalTrackedMeals: allMeals.length,
      meals: allMeals.map((meal: any) => ({
        id: meal.id,
        mealName: meal.mealName,
        kcal: meal.kcal,
        proteinG: meal.proteinG,
        loggedDate: meal.loggedDate,
        loggedDateISO: meal.loggedDate.toISOString(),
        createdAt: meal.createdAt,
        createdAtISO: meal.createdAt.toISOString(),
        mealPlanId: meal.mealPlanId,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
