import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

/**
 * POST /api/test-seed-weekly
 * Seeds 7 days of DailyLog + TrackedMeal data for testing getWeeklyTrend.
 * Only used in development.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const clerkId = await getClerkUserId()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Start from 7 days ago
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const created: string[] = []

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startDate)
    dayDate.setDate(dayDate.getDate() + i)
    const dateOnly = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate())

    // Random but realistic values
    const targetKcal = 2200
    const targetProteinG = 165
    const targetCarbsG = 220
    const targetFatG = 73
    const variation = 0.7 + Math.random() * 0.5 // 70-120%
    const actualKcal = Math.round(targetKcal * variation)
    const actualProteinG = Math.round(targetProteinG * variation)
    const actualCarbsG = Math.round(targetCarbsG * variation)
    const actualFatG = Math.round(targetFatG * variation)
    const adherenceScore = Math.round(Math.min(100, (1 - Math.abs(1 - variation)) * 100))

    // Upsert DailyLog
    await prisma.dailyLog.upsert({
      where: {
        userId_date: { userId: user.id, date: dateOnly },
      },
      update: {
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
      create: {
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

    // Create a test TrackedMeal for each day
    await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: dateOnly,
        mealSlot: 'lunch',
        mealName: `TEST_WEEKLY_${i}_${dateOnly.toISOString().split('T')[0]}`,
        portion: 1.0,
        kcal: actualKcal,
        proteinG: actualProteinG,
        carbsG: actualCarbsG,
        fatG: actualFatG,
        fiberG: 8,
        source: 'quick_add',
      },
    })

    created.push(dateOnly.toISOString().split('T')[0])
  }

  return NextResponse.json({
    success: true,
    startDate: startDate.toISOString(),
    daysSeeded: created,
    userId: user.id,
  })
}

/**
 * DELETE /api/test-seed-weekly
 * Cleans up test data created by the seed endpoint.
 */
export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const clerkId = await getClerkUserId()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const deleted = await prisma.trackedMeal.deleteMany({
    where: {
      userId: user.id,
      mealName: { startsWith: 'TEST_WEEKLY_' },
    },
  })

  return NextResponse.json({ success: true, deletedMeals: deleted.count })
}
