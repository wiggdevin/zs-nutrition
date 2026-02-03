import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { calculateAdherenceScore } from '@/lib/adherence'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/test-concurrent-log
 * Test endpoint: logs 3 meals concurrently and verifies totals.
 * Used for feature #331 verification.
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

    const today = new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Define 3 distinct meals to log concurrently
    const meals = [
      { mealName: 'CONCURRENT_TEST_A', kcal: 100, proteinG: 10, carbsG: 15, fatG: 5 },
      { mealName: 'CONCURRENT_TEST_B', kcal: 200, proteinG: 20, carbsG: 25, fatG: 10 },
      { mealName: 'CONCURRENT_TEST_C', kcal: 300, proteinG: 30, carbsG: 35, fatG: 15 },
    ]

    // Get current DailyLog totals before test
    const beforeLog = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: user.id, date: dateOnly } },
    })
    const beforeKcal = beforeLog?.actualKcal ?? 0
    const beforeProtein = beforeLog?.actualProteinG ?? 0
    const beforeCarbs = beforeLog?.actualCarbsG ?? 0
    const beforeFat = beforeLog?.actualFatG ?? 0

    // Fire all 3 meal logs concurrently using transactions
    const results = await Promise.all(
      meals.map((meal: any) =>
        prisma.$transaction(async (tx: any) => {
          const trackedMeal = await tx.trackedMeal.create({
            data: {
              userId: user.id,
              loggedDate: dateOnly,
              mealName: meal.mealName,
              portion: 1.0,
              kcal: meal.kcal,
              proteinG: meal.proteinG,
              carbsG: meal.carbsG,
              fatG: meal.fatG,
              fiberG: null,
              source: 'manual',
              confidenceScore: null,
            },
          })

          // Get targets from profile
          const profile = await tx.userProfile.findFirst({
            where: { userId: user.id, isActive: true },
            select: { goalKcal: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
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
                actualKcal: meal.kcal,
                actualProteinG: meal.proteinG,
                actualCarbsG: meal.carbsG,
                actualFatG: meal.fatG,
              },
            })
          } else {
            dailyLog = await tx.dailyLog.update({
              where: { id: dailyLog.id },
              data: {
                actualKcal: dailyLog.actualKcal + meal.kcal,
                actualProteinG: dailyLog.actualProteinG + meal.proteinG,
                actualCarbsG: dailyLog.actualCarbsG + meal.carbsG,
                actualFatG: dailyLog.actualFatG + meal.fatG,
              },
            })
          }

          const adherenceScore = calculateAdherenceScore(dailyLog)
          await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: { adherenceScore },
          })

          return { trackedMealId: trackedMeal.id, mealName: meal.mealName, dailyLogKcal: dailyLog.actualKcal }
        })
      )
    )

    // Verify: count the test meals and check DailyLog
    const testMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: dateOnly,
        mealName: { in: ['CONCURRENT_TEST_A', 'CONCURRENT_TEST_B', 'CONCURRENT_TEST_C'] },
      },
    })

    const afterLog = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: user.id, date: dateOnly } },
    })

    const expectedKcal = beforeKcal + 100 + 200 + 300
    const expectedProtein = beforeProtein + 10 + 20 + 30
    const expectedCarbs = beforeCarbs + 15 + 25 + 35
    const expectedFat = beforeFat + 5 + 10 + 15

    const mealsCreated = testMeals.length
    const kcalMatch = afterLog?.actualKcal === expectedKcal
    const proteinMatch = afterLog?.actualProteinG === expectedProtein
    const carbsMatch = afterLog?.actualCarbsG === expectedCarbs
    const fatMatch = afterLog?.actualFatG === expectedFat

    return NextResponse.json({
      success: true,
      mealsCreated,
      expectedMeals: 3,
      before: { kcal: beforeKcal, protein: beforeProtein, carbs: beforeCarbs, fat: beforeFat },
      after: {
        kcal: afterLog?.actualKcal,
        protein: afterLog?.actualProteinG,
        carbs: afterLog?.actualCarbsG,
        fat: afterLog?.actualFatG,
      },
      expected: { kcal: expectedKcal, protein: expectedProtein, carbs: expectedCarbs, fat: expectedFat },
      verification: {
        allMealsCreated: mealsCreated >= 3,
        kcalMatch,
        proteinMatch,
        carbsMatch,
        fatMatch,
        allPassing: mealsCreated >= 3 && kcalMatch && proteinMatch && carbsMatch && fatMatch,
      },
      transactionResults: results,
    })
  } catch (error) {
    safeLogError('Concurrent log test error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}

/**
 * DELETE /api/test-concurrent-log
 * Clean up test meals created by the POST endpoint.
 */
export async function DELETE(request: Request) {
  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const today = new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Delete test meals
    const deleted = await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        loggedDate: dateOnly,
        mealName: { in: ['CONCURRENT_TEST_A', 'CONCURRENT_TEST_B', 'CONCURRENT_TEST_C'] },
      },
    })

    // Recalculate DailyLog from remaining meals
    const remainingMeals = await prisma.trackedMeal.findMany({
      where: { userId: user.id, loggedDate: dateOnly },
    })

    const totals = remainingMeals.reduce(
      (acc: any, m: any) => ({
        kcal: acc.kcal + m.kcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )

    const dailyLog = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: user.id, date: dateOnly } },
    })

    if (dailyLog) {
      const updatedLog = await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: {
          actualKcal: Math.round(totals.kcal),
          actualProteinG: Math.round(totals.proteinG),
          actualCarbsG: Math.round(totals.carbsG),
          actualFatG: Math.round(totals.fatG),
        },
      })
      const adherenceScore = calculateAdherenceScore(updatedLog)
      await prisma.dailyLog.update({
        where: { id: updatedLog.id },
        data: { adherenceScore },
      })
    }

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (error) {
    safeLogError('Cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
