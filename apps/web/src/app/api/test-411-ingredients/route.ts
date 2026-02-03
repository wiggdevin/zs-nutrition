import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'

/**
 * Test endpoint for feature #411: Meal ingredient display
 * Returns the current meal plan with ingredient details
 */
export async function GET() {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    // Get the dev user's meal plan
    const user = await prisma.user.findUnique({
      where: { email: 'dev@zsnutrition.test' },
    })

    if (!user) {
      return NextResponse.json({ error: 'Dev user not found' }, { status: 404 })
    }

    const plan = await prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'No active meal plan found' }, { status: 404 })
    }

    const validatedPlan = JSON.parse(plan.validatedPlan)

    // Extract first meal's ingredients as a sample
    const sampleMeal = validatedPlan.days[0]?.meals[0]

    return NextResponse.json({
      planId: plan.id,
      sampleMeal: {
        name: sampleMeal?.name,
        slot: sampleMeal?.slot,
        ingredients: sampleMeal?.ingredients || [],
        ingredientsCount: sampleMeal?.ingredients?.length || 0,
      },
      allMeals: validatedPlan.days.map((day: any) => ({
        dayNumber: day.dayNumber,
        mealCount: day.meals.length,
        firstMealIngredients: day.meals[0]?.ingredients || [],
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
