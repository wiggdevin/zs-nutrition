import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * PUT /api/tracking/adjust-portion
 * Adjust the portion of an already-logged meal.
 * Scales nutrition values proportionally and recalculates DailyLog totals.
 */
export async function PUT(request: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    const { trackedMealId, newPortion } = body

    if (!trackedMealId || typeof trackedMealId !== 'string') {
      return NextResponse.json({ error: 'trackedMealId is required' }, { status: 400 })
    }

    if (typeof newPortion !== 'number' || newPortion <= 0 || newPortion > 10) {
      return NextResponse.json(
        { error: 'newPortion must be a number between 0.1 and 10' },
        { status: 400 }
      )
    }

    // Get the tracked meal, ensuring it belongs to this user
    const trackedMeal = await prisma.trackedMeal.findFirst({
      where: { id: trackedMealId, userId: user.id },
    })

    if (!trackedMeal) {
      return NextResponse.json({ error: 'Tracked meal not found' }, { status: 404 })
    }

    // Calculate base nutrition values (per 1.0 portion)
    const oldPortion = trackedMeal.portion || 1.0
    const baseKcal = trackedMeal.kcal / oldPortion
    const baseProteinG = trackedMeal.proteinG / oldPortion
    const baseCarbsG = trackedMeal.carbsG / oldPortion
    const baseFatG = trackedMeal.fatG / oldPortion
    const baseFiberG = trackedMeal.fiberG !== null ? trackedMeal.fiberG / oldPortion : null

    // Apply new portion multiplier
    const newKcal = Math.round(baseKcal * newPortion)
    const newProteinG = Math.round(baseProteinG * newPortion * 10) / 10
    const newCarbsG = Math.round(baseCarbsG * newPortion * 10) / 10
    const newFatG = Math.round(baseFatG * newPortion * 10) / 10
    const newFiberG = baseFiberG !== null ? Math.round(baseFiberG * newPortion * 10) / 10 : null

    // Update the tracked meal
    const updatedMeal = await prisma.trackedMeal.update({
      where: { id: trackedMealId },
      data: {
        portion: newPortion,
        kcal: newKcal,
        proteinG: newProteinG,
        carbsG: newCarbsG,
        fatG: newFatG,
        fiberG: newFiberG,
      },
    })

    // Recalculate DailyLog totals from ALL tracked meals for this day
    const loggedDate = new Date(
      trackedMeal.loggedDate.getFullYear(),
      trackedMeal.loggedDate.getMonth(),
      trackedMeal.loggedDate.getDate()
    )

    const allMealsForDay = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: loggedDate,
      },
    })

    const totals = allMealsForDay.reduce(
      (acc, meal) => ({
        kcal: acc.kcal + meal.kcal,
        proteinG: acc.proteinG + meal.proteinG,
        carbsG: acc.carbsG + meal.carbsG,
        fatG: acc.fatG + meal.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )

    // Update DailyLog with recalculated totals
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId: user.id, date: loggedDate },
      },
    })

    if (dailyLog) {
      const adherenceScore =
        dailyLog.targetKcal && dailyLog.targetKcal > 0
          ? Math.min(100, Math.round((Math.round(totals.kcal) / dailyLog.targetKcal) * 100))
          : 0

      await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: {
          actualKcal: Math.round(totals.kcal),
          actualProteinG: Math.round(totals.proteinG),
          actualCarbsG: Math.round(totals.carbsG),
          actualFatG: Math.round(totals.fatG),
          adherenceScore,
        },
      })
    }

    return NextResponse.json({
      success: true,
      trackedMeal: {
        id: updatedMeal.id,
        mealName: updatedMeal.mealName,
        portion: updatedMeal.portion,
        kcal: updatedMeal.kcal,
        proteinG: updatedMeal.proteinG,
        carbsG: updatedMeal.carbsG,
        fatG: updatedMeal.fatG,
      },
      dailyTotals: {
        actualKcal: Math.round(totals.kcal),
        actualProteinG: Math.round(totals.proteinG),
        actualCarbsG: Math.round(totals.carbsG),
        actualFatG: Math.round(totals.fatG),
      },
    })
  } catch (error) {
    safeLogError('Adjust portion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
