import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { calculateAdherenceScore } from '@/lib/adherence'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/tracking/quick-add
 * Quickly log calories and optional macros without searching for a food.
 * Creates a TrackedMeal with source='quick_add' and updates the DailyLog.
 */
export async function POST(request: Request) {
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
    const { calories, protein, carbs, fat, label } = body

    // Validate required field: calories
    if (calories === undefined || calories === null || isNaN(Number(calories)) || Number(calories) <= 0) {
      return NextResponse.json({ error: 'A valid calorie amount is required (must be > 0)' }, { status: 400 })
    }

    const kcal = Math.round(Number(calories))
    const proteinG = Math.round((Number(protein) || 0) * 10) / 10
    const carbsG = Math.round((Number(carbs) || 0) * 10) / 10
    const fatG = Math.round((Number(fat) || 0) * 10) / 10

    // Generate a default label if none provided
    const mealName = (label && typeof label === 'string' && label.trim().length > 0)
      ? label.trim()
      : `Quick Add (${kcal} kcal)`

    const today = new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Use a serialized transaction to prevent race conditions from concurrent tabs
    const result = await prisma.$transaction(async (tx) => {
      // Duplicate detection: check if an identical meal was logged in the last 10 seconds
      const tenSecondsAgo = new Date(Date.now() - 10000)
      const recentDuplicate = await tx.trackedMeal.findFirst({
        where: {
          userId: user.id,
          loggedDate: dateOnly,
          mealName,
          kcal,
          source: 'quick_add',
          createdAt: { gte: tenSecondsAgo },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (recentDuplicate) {
        const existingDailyLog = await tx.dailyLog.findUnique({
          where: { userId_date: { userId: user.id, date: dateOnly } },
        })
        return {
          success: true,
          duplicate: true,
          trackedMeal: {
            id: recentDuplicate.id,
            mealName: recentDuplicate.mealName,
            kcal: recentDuplicate.kcal,
            proteinG: recentDuplicate.proteinG,
            carbsG: recentDuplicate.carbsG,
            fatG: recentDuplicate.fatG,
            source: recentDuplicate.source,
          },
          dailyLog: existingDailyLog ? {
            actualKcal: existingDailyLog.actualKcal,
            actualProteinG: existingDailyLog.actualProteinG,
            actualCarbsG: existingDailyLog.actualCarbsG,
            actualFatG: existingDailyLog.actualFatG,
            adherenceScore: existingDailyLog.adherenceScore,
          } : null,
        }
      }

      // Create TrackedMeal with source='quick_add'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          mealPlanId: null,
          loggedDate: dateOnly,
          mealSlot: null,
          mealName,
          portion: 1.0,
          kcal,
          proteinG,
          carbsG,
          fatG,
          fiberG: null,
          source: 'quick_add',
          confidenceScore: null,
        },
      })

      // Update or create DailyLog
      let dailyLog = await tx.dailyLog.findUnique({
        where: {
          userId_date: { userId: user.id, date: dateOnly },
        },
      })

      const profile = await tx.userProfile.findFirst({
        where: { userId: user.id, isActive: true },
        select: { goalKcal: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
      })

      if (!dailyLog) {
        dailyLog = await tx.dailyLog.create({
          data: {
            userId: user.id,
            date: dateOnly,
            targetKcal: profile?.goalKcal || 2000,
            targetProteinG: profile?.proteinTargetG || 150,
            targetCarbsG: profile?.carbsTargetG || 200,
            targetFatG: profile?.fatTargetG || 65,
            actualKcal: kcal,
            actualProteinG: Math.round(proteinG),
            actualCarbsG: Math.round(carbsG),
            actualFatG: Math.round(fatG),
          },
        })
      } else {
        dailyLog = await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: {
            actualKcal: dailyLog.actualKcal + kcal,
            actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
            actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
            actualFatG: dailyLog.actualFatG + Math.round(fatG),
          },
        })
      }

      const adherenceScore = calculateAdherenceScore(dailyLog)
      await tx.dailyLog.update({
        where: { id: dailyLog.id },
        data: { adherenceScore },
      })

      return {
        success: true,
        trackedMeal: {
          id: trackedMeal.id,
          mealName: trackedMeal.mealName,
          kcal: trackedMeal.kcal,
          proteinG: trackedMeal.proteinG,
          carbsG: trackedMeal.carbsG,
          fatG: trackedMeal.fatG,
          source: trackedMeal.source,
        },
        dailyLog: {
          actualKcal: dailyLog.actualKcal,
          actualProteinG: dailyLog.actualProteinG,
          actualCarbsG: dailyLog.actualCarbsG,
          actualFatG: dailyLog.actualFatG,
          adherenceScore,
        },
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    safeLogError('Quick add error:', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
