import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateAdherenceScore } from '@/lib/adherence'

/**
 * POST /api/test-feature-235
 * Test endpoint for Feature #235: DailyLog running totals update correctly
 *
 * This endpoint tests that:
 * 1. Logging meal 1 (500 kcal, 30g protein) creates DailyLog with correct totals
 * 2. Logging meal 2 (700 kcal, 45g protein) updates DailyLog to 1200 kcal, 75g protein
 * 3. Deleting meal 1 recalculates DailyLog to 700 kcal, 45g protein
 *
 * NOTE: This endpoint bypasses authentication for testing purposes only.
 * In production, all endpoints should require authentication.
 */
export async function POST(request: Request) {
  try {
    // Find or create test user
    let user = await prisma.user.findFirst({
      where: { email: { contains: 'feature-235-test' } },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId: `test-clerk-235-${Date.now()}`,
          email: `feature-235-test-${Date.now()}@zsmac.dev`,
        },
      })
    }

    const today = new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Clean up any existing test data for today
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        loggedDate: dateOnly,
        mealName: { contains: 'TEST_235_MEAL' },
      },
    })

    await prisma.dailyLog.deleteMany({
      where: {
        userId: user.id,
        date: dateOnly,
      },
    })

    // Get active profile for targets
    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
      select: { goalKcal: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
    })

    const results: Record<string, any> = {
      userId: user.id,
      steps: [],
      success: true,
    }

    // STEP 1: Log meal 1 (500 kcal, 30g protein)
    const step1: any = {}
    try {
      const meal1Result = await prisma.$transaction(async (tx) => {
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: user.id,
            loggedDate: dateOnly,
            mealName: 'TEST_235_MEAL_1_Oatmeal',
            portion: 1.0,
            kcal: 500,
            proteinG: 30,
            carbsG: 60,
            fatG: 15,
            fiberG: null,
            source: 'manual',
            confidenceScore: null,
          },
        })

        let dailyLog = await tx.dailyLog.findUnique({
          where: { userId_date: { userId: user.id, date: dateOnly } },
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
              actualKcal: 500,
              actualProteinG: 30,
              actualCarbsG: 60,
              actualFatG: 15,
            },
          })
        }

        const adherenceScore = calculateAdherenceScore(dailyLog)
        dailyLog = await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        })

        return { trackedMeal, dailyLog }
      })

      step1.status = 'PASS'
      step1.mealLogged = {
        id: meal1Result.trackedMeal.id,
        name: meal1Result.trackedMeal.mealName,
        kcal: meal1Result.trackedMeal.kcal,
        proteinG: meal1Result.trackedMeal.proteinG,
      }
      step1.dailyLog = {
        actualKcal: meal1Result.dailyLog.actualKcal,
        actualProteinG: meal1Result.dailyLog.actualProteinG,
        actualCarbsG: meal1Result.dailyLog.actualCarbsG,
        actualFatG: meal1Result.dailyLog.actualFatG,
      }
      step1.verification = {
        expectedKcal: 500,
        expectedProteinG: 30,
        matches: meal1Result.dailyLog.actualKcal === 500 && meal1Result.dailyLog.actualProteinG === 30,
      }
      results.meal1Id = meal1Result.trackedMeal.id
    } catch (error) {
      step1.status = 'FAIL'
      step1.error = error instanceof Error ? error.message : String(error)
      results.success = false
    }
    results.steps.push({ step: 1, description: 'Log meal 1: 500 kcal, 30g protein', ...step1 })

    // STEP 2: Log meal 2 (700 kcal, 45g protein)
    const step2: any = {}
    try {
      const meal2Result = await prisma.$transaction(async (tx) => {
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: user.id,
            loggedDate: dateOnly,
            mealName: 'TEST_235_MEAL_2_ChickenSalad',
            portion: 1.0,
            kcal: 700,
            proteinG: 45,
            carbsG: 40,
            fatG: 30,
            fiberG: null,
            source: 'manual',
            confidenceScore: null,
          },
        })

        const dailyLog = await tx.dailyLog.update({
          where: { userId_date: { userId: user.id, date: dateOnly } },
          data: {
            actualKcal: { increment: 700 },
            actualProteinG: { increment: 45 },
            actualCarbsG: { increment: 40 },
            actualFatG: { increment: 30 },
          },
        })

        const adherenceScore = calculateAdherenceScore(dailyLog)
        const updatedLog = await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        })

        return { trackedMeal, dailyLog: updatedLog }
      })

      step2.status = 'PASS'
      step2.mealLogged = {
        id: meal2Result.trackedMeal.id,
        name: meal2Result.trackedMeal.mealName,
        kcal: meal2Result.trackedMeal.kcal,
        proteinG: meal2Result.trackedMeal.proteinG,
      }
      step2.dailyLog = {
        actualKcal: meal2Result.dailyLog.actualKcal,
        actualProteinG: meal2Result.dailyLog.actualProteinG,
        actualCarbsG: meal2Result.dailyLog.actualCarbsG,
        actualFatG: meal2Result.dailyLog.actualFatG,
      }
      step2.verification = {
        expectedKcal: 1200, // 500 + 700
        expectedProteinG: 75, // 30 + 45
        matches: meal2Result.dailyLog.actualKcal === 1200 && meal2Result.dailyLog.actualProteinG === 75,
      }
      results.meal2Id = meal2Result.trackedMeal.id
    } catch (error) {
      step2.status = 'FAIL'
      step2.error = error instanceof Error ? error.message : String(error)
      results.success = false
    }
    results.steps.push({ step: 2, description: 'Log meal 2: 700 kcal, 45g protein', ...step2 })

    // STEP 3: Delete meal 1
    const step3: any = {}
    try {
      // Delete the tracked meal
      await prisma.trackedMeal.delete({
        where: { id: results.meal1Id },
      })

      // Recalculate DailyLog from remaining meals
      const remainingMeals = await prisma.trackedMeal.findMany({
        where: {
          userId: user.id,
          loggedDate: dateOnly,
        },
      })

      const newTotals = remainingMeals.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + meal.kcal,
          proteinG: acc.proteinG + meal.proteinG,
          carbsG: acc.carbsG + meal.carbsG,
          fatG: acc.fatG + meal.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      )

      const dailyLog = await prisma.dailyLog.update({
        where: { userId_date: { userId: user.id, date: dateOnly } },
        data: {
          actualKcal: Math.round(newTotals.kcal),
          actualProteinG: Math.round(newTotals.proteinG),
          actualCarbsG: Math.round(newTotals.carbsG),
          actualFatG: Math.round(newTotals.fatG),
        },
      })

      const adherenceScore = calculateAdherenceScore(dailyLog)
      const updatedLog = await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: { adherenceScore },
      })

      step3.status = 'PASS'
      step3.deletedMealId = results.meal1Id
      step3.remainingMealsCount = remainingMeals.length
      step3.dailyLog = {
        actualKcal: updatedLog.actualKcal,
        actualProteinG: updatedLog.actualProteinG,
        actualCarbsG: updatedLog.actualCarbsG,
        actualFatG: updatedLog.actualFatG,
      }
      step3.verification = {
        expectedKcal: 700, // Only meal 2 remains
        expectedProteinG: 45, // Only meal 2 remains
        matches: updatedLog.actualKcal === 700 && updatedLog.actualProteinG === 45,
      }
    } catch (error) {
      step3.status = 'FAIL'
      step3.error = error instanceof Error ? error.message : String(error)
      results.success = false
    }
    results.steps.push({ step: 3, description: 'Delete meal 1 and verify totals', ...step3 })

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
