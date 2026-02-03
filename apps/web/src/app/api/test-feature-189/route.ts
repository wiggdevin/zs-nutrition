import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { toLocalDay, parseLocalDay } from '@/lib/date-utils'
import { cookies } from 'next/headers'

/**
 * POST /api/test-feature-189
 * Test endpoint for Feature #189: Tracked meals organized by date and meal slot
 * Creates test meals with different dates and slots
 */
export async function POST(request: Request) {
  try {
    // For testing, allow both authenticated users and dev mode
    let user
    const clerkUserId = await getClerkUserId()

    if (clerkUserId) {
      user = await prisma.user.findUnique({ where: { clerkUserId } })
    } else {
      // Dev mode fallback: use dev-user-id cookie directly
      const cookieStore = await cookies()
      const devUserId = cookieStore.get('dev-user-id')?.value
      if (devUserId) {
        user = await prisma.user.findUnique({ where: { id: devUserId } })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const today = toLocalDay()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)

    const testMeals = [
      // Today's meals with different slots
      {
        userId: user.id,
        loggedDate: today,
        mealSlot: 'breakfast',
        mealName: 'TEST_189_Breakfast_Oatmeal',
        portion: 1.0,
        kcal: 350,
        proteinG: 12,
        carbsG: 55,
        fatG: 8,
        fiberG: 6,
        source: 'manual',
        confidenceScore: 1.0,
      },
      {
        userId: user.id,
        loggedDate: today,
        mealSlot: 'lunch',
        mealName: 'TEST_189_Lunch_ChickenSalad',
        portion: 1.0,
        kcal: 450,
        proteinG: 35,
        carbsG: 20,
        fatG: 22,
        fiberG: 8,
        source: 'manual',
        confidenceScore: 1.0,
      },
      {
        userId: user.id,
        loggedDate: today,
        mealSlot: 'dinner',
        mealName: 'TEST_189_Dinner_Salmon',
        portion: 1.0,
        kcal: 550,
        proteinG: 40,
        carbsG: 30,
        fatG: 28,
        fiberG: 4,
        source: 'manual',
        confidenceScore: 1.0,
      },
      {
        userId: user.id,
        loggedDate: today,
        mealSlot: 'snack',
        mealName: 'TEST_189_Snack_Apple',
        portion: 1.0,
        kcal: 150,
        proteinG: 1,
        carbsG: 35,
        fatG: 0.5,
        fiberG: 4,
        source: 'manual',
        confidenceScore: 1.0,
      },
      {
        userId: user.id,
        loggedDate: today,
        mealSlot: null,
        mealName: 'TEST_189_NoSlot_Snack',
        portion: 1.0,
        kcal: 100,
        proteinG: 2,
        carbsG: 20,
        fatG: 2,
        fiberG: 2,
        source: 'manual',
        confidenceScore: 1.0,
      },
      // Yesterday's meals
      {
        userId: user.id,
        loggedDate: yesterday,
        mealSlot: 'breakfast',
        mealName: 'TEST_189_Yesterday_Breakfast',
        portion: 1.0,
        kcal: 400,
        proteinG: 15,
        carbsG: 60,
        fatG: 10,
        fiberG: 8,
        source: 'manual',
        confidenceScore: 1.0,
      },
      {
        userId: user.id,
        loggedDate: yesterday,
        mealSlot: 'lunch',
        mealName: 'TEST_189_Yesterday_Lunch',
        portion: 1.0,
        kcal: 500,
        proteinG: 30,
        carbsG: 45,
        fatG: 20,
        fiberG: 10,
        source: 'manual',
        confidenceScore: 1.0,
      },
      // Day before yesterday
      {
        userId: user.id,
        loggedDate: dayBefore,
        mealSlot: 'dinner',
        mealName: 'TEST_189_Day2_Dinner',
        portion: 1.0,
        kcal: 600,
        proteinG: 45,
        carbsG: 40,
        fatG: 25,
        fiberG: 6,
        source: 'manual',
        confidenceScore: 1.0,
      },
    ]

    // Delete existing test meals first
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { startsWith: 'TEST_189_' },
      },
    })

    // Create new test meals
    const created = await prisma.trackedMeal.createMany({
      data: testMeals,
    })

    return NextResponse.json({
      success: true,
      message: `Created ${created.count} test meals for feature #189`,
      meals: testMeals.map(m => ({
        name: m.mealName,
        date: m.loggedDate.toISOString().split('T')[0],
        slot: m.mealSlot || 'none',
        kcal: m.kcal,
      })),
    })
  } catch (error) {
    console.error('Error creating test meals for feature 189:', error)
    return NextResponse.json(
      { error: 'Failed to create test meals' },
      { status: 500 }
    )
  }
}
