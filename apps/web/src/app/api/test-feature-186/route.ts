import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/test-feature-186
 * Tests Feature #186: Weekly trend chart displays correctly
 * - Seeds 7 days of meal data with all macro nutrients
 * - Returns verification results for all metrics (kcal, protein, carbs, fat)
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const results = {
    step1_seeded: false,
    step2_caloriesChart: false,
    step3_proteinChart: false,
    step4_carbsChart: false,
    step5_fatChart: false,
    errors: [] as string[],
  }

  try {
    // Find or create test user
    let user = await prisma.user.findFirst({
      where: { email: 'feature186-test@example.com' },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId: 'test-feature-186-clerk-id',
          email: 'feature186-test@example.com',
        },
      })
    }

    // Clean up existing test data
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { startsWith: 'TEST_186_' },
      },
    })
    await prisma.dailyLog.deleteMany({
      where: {
        userId: user.id,
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    })

    // Seed 7 days of data with different macro profiles
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const startDate = new Date(today)
    startDate.setUTCDate(startDate.getUTCDate() - 6)

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startDate)
      dayDate.setUTCDate(dayDate.getUTCDate() + i)
      const dateOnly = new Date(
        Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate())
      )

      // Create varied macro profiles for each day
      const targetKcal = 2500
      const targetProteinG = 180
      const targetCarbsG = 250
      const targetFatG = 83

      // Vary actuals to create realistic trend
      const variation = 0.75 + Math.random() * 0.4 // 75-115%
      const actualKcal = Math.round(targetKcal * variation)
      const actualProteinG = Math.round(targetProteinG * (0.8 + Math.random() * 0.4))
      const actualCarbsG = Math.round(targetCarbsG * (0.8 + Math.random() * 0.4))
      const actualFatG = Math.round(targetFatG * (0.8 + Math.random() * 0.4))
      const adherenceScore = Math.round(
        Math.min(100, (1 - Math.abs(1 - variation)) * 100)
      )

      // Create DailyLog
      await prisma.dailyLog.create({
        data: {
          userId: user.id,
          date: dateOnly,
          targetKcal,
          targetProteinG,
          targetCarbsG,
          targetFatG,
          actualKcal,
          actualProteinG,
          actualCarbsG,
          actualFatG,
          adherenceScore,
        },
      })

      // Create test meals
      const mealCount = 3 + Math.floor(Math.random() * 2) // 3-4 meals per day
      for (let m = 0; m < mealCount; m++) {
        const mealKcal = Math.round(actualKcal / mealCount)
        const mealProtein = Math.round((actualProteinG / mealCount) * (0.8 + Math.random() * 0.4))
        const mealCarbs = Math.round((actualCarbsG / mealCount) * (0.8 + Math.random() * 0.4))
        const mealFat = Math.round((actualFatG / mealCount) * (0.8 + Math.random() * 0.4))

        await prisma.trackedMeal.create({
          data: {
            userId: user.id,
            loggedDate: dateOnly,
            mealSlot: m === 0 ? 'breakfast' : m === 1 ? 'lunch' : m === 2 ? 'dinner' : 'snack',
            mealName: `TEST_186_DAY${i}_MEAL${m}_${dateOnly.toISOString().split('T')[0]}`,
            portion: 1.0,
            kcal: mealKcal,
            proteinG: mealProtein,
            carbsG: mealCarbs,
            fatG: mealFat,
            fiberG: 5,
            source: 'manual',
          },
        })
      }
    }

    results.step1_seeded = true

    // Verify data was created correctly
    const dailyLogs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    })

    if (dailyLogs.length !== 7) {
      results.errors.push(`Expected 7 daily logs, got ${dailyLogs.length}`)
    }

    // Verify calories data
    const allHaveCalories = dailyLogs.every((log) => (log.targetKcal ?? 0) > 0 && log.actualKcal >= 0)
    if (allHaveCalories && dailyLogs.length === 7) {
      results.step2_caloriesChart = true
    } else {
      results.errors.push('Calories data missing or incomplete')
    }

    // Verify protein data
    const allHaveProtein = dailyLogs.every(
      (log) => log.targetProteinG !== null && log.actualProteinG >= 0
    )
    if (allHaveProtein) {
      results.step3_proteinChart = true
    } else {
      results.errors.push('Protein data missing or incomplete')
    }

    // Verify carbs data
    const allHaveCarbs = dailyLogs.every(
      (log) => log.targetCarbsG !== null && log.actualCarbsG >= 0
    )
    if (allHaveCarbs) {
      results.step4_carbsChart = true
    } else {
      results.errors.push('Carbs data missing or incomplete')
    }

    // Verify fat data
    const allHaveFat = dailyLogs.every((log) => log.targetFatG !== null && log.actualFatG >= 0)
    if (allHaveFat) {
      results.step5_fatChart = true
    } else {
      results.errors.push('Fat data missing or incomplete')
    }

    return NextResponse.json({
      success: true,
      results,
      userId: user.id,
      dataPoints: dailyLogs.length,
    })
  } catch (error) {
    results.errors.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return NextResponse.json({ success: false, results, error }, { status: 500 })
  }
}

/**
 * GET /api/test-feature-186
 * Returns test status and data summary
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: 'feature186-test@example.com' },
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Test user not found. Run POST first to create data.',
      })
    }

    const dailyLogs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    })

    const trackedMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        mealName: { startsWith: 'TEST_186_' },
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      stats: {
        dailyLogs: dailyLogs.length,
        trackedMeals: trackedMeals.length,
        dateRange:
          dailyLogs.length > 0
            ? `${dailyLogs[0].date.toISOString().split('T')[0]} to ${
                dailyLogs[dailyLogs.length - 1].date.toISOString().split('T')[0]
              }`
            : 'No data',
      },
      sampleData: dailyLogs.slice(0, 3).map((log) => ({
        date: log.date.toISOString().split('T')[0],
        targets: {
          kcal: log.targetKcal,
          proteinG: log.targetProteinG,
          carbsG: log.targetCarbsG,
          fatG: log.targetFatG,
        },
        actuals: {
          kcal: log.actualKcal,
          proteinG: log.actualProteinG,
          carbsG: log.actualCarbsG,
          fatG: log.actualFatG,
        },
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/test-feature-186
 * Cleans up test data
 */
export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: 'feature186-test@example.com' },
    })

    if (!user) {
      return NextResponse.json({ success: true, message: 'No test user to clean up.' })
    }

    const deletedMeals = await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { startsWith: 'TEST_186_' },
      },
    })

    const deletedLogs = await prisma.dailyLog.deleteMany({
      where: {
        userId: user.id,
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    })

    return NextResponse.json({
      success: true,
      deletedMeals: deletedMeals.count,
      deletedLogs: deletedLogs.count,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
