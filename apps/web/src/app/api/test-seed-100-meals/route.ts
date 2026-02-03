import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * DEV TEST ENDPOINT: Seed 100+ tracked meals for performance testing
 * This creates meals spread across various dates to test pagination and rendering performance
 *
 * DEV MODE: If NEXT_PUBLIC_DEV_MODE is set, allows unauthenticated access for testing
 */
export async function POST() {
  try {
    // DEV MODE: Skip auth for testing performance with large datasets
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development'

    let user
    if (isDevMode) {
      // In dev mode, get first active user for testing
      user = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      })
      if (!user) {
        return NextResponse.json({ error: 'No users found. Create an account first.' }, { status: 404 })
      }
    } else {
      const clerkUserId = await getClerkUserId()
      if (!clerkUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = await prisma.user.findUnique({
        where: { clerkUserId },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Create 100 meals spread across today and the past 10 days
    const mealsToCreate = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const mealTemplates = [
      { name: 'PERF_TEST_001 - Chicken Breast', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, source: 'manual' as const },
      { name: 'PERF_TEST_002 - Brown Rice', kcal: 216, proteinG: 5, carbsG: 45, fatG: 1.8, source: 'manual' as const },
      { name: 'PERF_TEST_003 - Broccoli', kcal: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, source: 'manual' as const },
      { name: 'PERF_TEST_004 - Salmon Fillet', kcal: 208, proteinG: 22, carbsG: 0, fatG: 13, source: 'manual' as const },
      { name: 'PERF_TEST_005 - Sweet Potato', kcal: 103, proteinG: 2.3, carbsG: 24, fatG: 0.1, source: 'manual' as const },
      { name: 'PERF_TEST_006 - Greek Yogurt', kcal: 100, proteinG: 17, carbsG: 6, fatG: 0.7, source: 'manual' as const },
      { name: 'PERF_TEST_007 - Oatmeal', kcal: 150, proteinG: 5, carbsG: 27, fatG: 3, source: 'manual' as const },
      { name: 'PERF_TEST_008 - Eggs (2 large)', kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, source: 'manual' as const },
      { name: 'PERF_TEST_009 - Avocado', kcal: 160, proteinG: 2, carbsG: 9, fatG: 15, source: 'manual' as const },
      { name: 'PERF_TEST_010 - Almonds ( handful)', kcal: 164, proteinG: 6, carbsG: 6, fatG: 14, source: 'manual' as const },
    ]

    // Create 110 meals total: 15 today + 10 per day for previous 10 days
    let mealIndex = 0
    const dates: Date[] = []

    // Today: 15 meals
    for (let i = 0; i < 15; i++) {
      dates.push(new Date(today))
    }

    // Previous 10 days: 10 meals each = 100 meals
    for (let dayOffset = 1; dayOffset <= 10; dayOffset++) {
      const date = new Date(today)
      date.setDate(date.getDate() - dayOffset)
      for (let i = 0; i < 10; i++) {
        dates.push(date)
      }
    }

    for (const loggedDate of dates) {
      const template = mealTemplates[mealIndex % mealTemplates.length]
      const slot = ['breakfast', 'lunch', 'dinner', 'snack'][mealIndex % 4]

      mealsToCreate.push({
        userId: user.id,
        loggedDate,
        mealName: `PERF_TEST_${String(mealIndex + 1).padStart(3, '0')}`,
        mealSlot: slot,
        kcal: template.kcal,
        proteinG: template.proteinG,
        carbsG: template.carbsG,
        fatG: template.fatG,
        fiberG: 0,
        portion: 1.0,
        source: template.source,
        confidenceScore: 1.0,
      })

      mealIndex++
    }

    // Bulk create all meals
    const created = await prisma.trackedMeal.createMany({
      data: mealsToCreate,
    })

    return NextResponse.json({
      success: true,
      seeded: created.count,
      message: `Seeded ${created.count} test meals across 11 days (15 today + 10 per day for 10 days)`,
      today: dates.filter(d => d.getTime() === today.getTime()).length,
      previousDays: dates.length - dates.filter(d => d.getTime() === today.getTime()).length,
    })
  } catch (error) {
    safeLogError('Seed meals error:', error)
    return NextResponse.json({ error: 'Failed to seed meals' }, { status: 500 })
  }
}

/**
 * DELETE: Remove all test meals (cleanup)
 */
export async function DELETE() {
  try {
    // DEV MODE: Skip auth for testing
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development'

    let user
    if (isDevMode) {
      user = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      })
      if (!user) {
        return NextResponse.json({ error: 'No users found' }, { status: 404 })
      }
    } else {
      const clerkUserId = await getClerkUserId()
      if (!clerkUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = await prisma.user.findUnique({
        where: { clerkUserId },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Delete all meals starting with PERF_TEST_
    const deleted = await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { startsWith: 'PERF_TEST_' },
      },
    })

    // Also update DailyLog entries to recalculate
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Reset today's daily log if it exists
    await prisma.dailyLog.updateMany({
      where: {
        userId: user.id,
        date: { gte: today },
      },
      data: {
        actualKcal: 0,
        actualProteinG: 0,
        actualCarbsG: 0,
        actualFatG: 0,
        adherenceScore: 0,
      },
    })

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      message: `Deleted ${deleted.count} test meals`,
    })
  } catch (error) {
    safeLogError('Delete seed meals error:', error)
    return NextResponse.json({ error: 'Failed to delete test meals' }, { status: 500 })
  }
}
