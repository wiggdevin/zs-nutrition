import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { toLocalDay, formatLocalDay } from '@/lib/date-utils'

/**
 * POST /api/test-midnight-327
 *
 * Comprehensive test for Feature #327 - Date-based tracking with correct day boundaries.
 *
 * This test verifies that meals logged near midnight are assigned to the correct day.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Clean up any existing test data
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { contains: 'MIDNIGHT_TEST_327_' }
      }
    })

    const results: any[] = []
    const now = new Date()
    const today = formatLocalDay(now)

    // Test 1: Log a meal at 11:00 PM today (should be assigned to today)
    const lateEvening = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      0,
      0
    )
    const lateEveningDay = toLocalDay(lateEvening)

    const meal1 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: lateEveningDay,
        mealName: 'MIDNIGHT_TEST_327_11PM_TODAY',
        portion: 1.0,
        kcal: 400,
        proteinG: 25,
        carbsG: 35,
        fatG: 10,
        source: 'manual',
      }
    })

    results.push({
      test: 'Meal at 11:00 PM today',
      loggedTime: lateEvening.toISOString(),
      assignedDate: meal1.loggedDate.toISOString().split('T')[0],
      expectedDate: today,
      pass: meal1.loggedDate.toISOString().split('T')[0] === today
    })

    // Test 2: Log a meal at 1:00 AM today (should be assigned to today)
    const earlyMorning = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      1,
      0,
      0
    )
    const earlyMorningDay = toLocalDay(earlyMorning)

    const meal2 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: earlyMorningDay,
        mealName: 'MIDNIGHT_TEST_327_1AM_TODAY',
        portion: 1.0,
        kcal: 300,
        proteinG: 20,
        carbsG: 30,
        fatG: 8,
        source: 'manual',
      }
    })

    results.push({
      test: 'Meal at 1:00 AM today',
      loggedTime: earlyMorning.toISOString(),
      assignedDate: meal2.loggedDate.toISOString().split('T')[0],
      expectedDate: today,
      pass: meal2.loggedDate.toISOString().split('T')[0] === today
    })

    // Test 3: Query all meals for today - should find both meals
    const todayMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: lateEveningDay
      }
    })

    results.push({
      test: 'Query meals for today (should include both 1AM and 11PM)',
      queryDate: today,
      found: todayMeals.length,
      expected: 2,
      pass: todayMeals.length === 2,
      mealNames: todayMeals.map(m => m.mealName)
    })

    // Test 4: Verify yesterday has no meals from this test
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayDay = toLocalDay(yesterday)

    const yesterdayMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: yesterdayDay,
        mealName: { contains: 'MIDNIGHT_TEST_327_' }
      }
    })

    results.push({
      test: 'Query meals for yesterday (should have no test meals)',
      queryDate: formatLocalDay(yesterday),
      found: yesterdayMeals.length,
      expected: 0,
      pass: yesterdayMeals.length === 0
    })

    // Test 5: Simulate logging a meal at 11:59:59 PM
    const almostMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    )
    const almostMidnightDay = toLocalDay(almostMidnight)

    const meal3 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: almostMidnightDay,
        mealName: 'MIDNIGHT_TEST_327_1159PM',
        portion: 1.0,
        kcal: 200,
        proteinG: 15,
        carbsG: 20,
        fatG: 5,
        source: 'manual',
      }
    })

    results.push({
      test: 'Meal at 11:59:59 PM (just before midnight)',
      loggedTime: almostMidnight.toISOString(),
      assignedDate: meal3.loggedDate.toISOString().split('T')[0],
      expectedDate: today,
      pass: meal3.loggedDate.toISOString().split('T')[0] === today
    })

    // Test 6: Simulate logging a meal at 12:00:01 AM tomorrow (should be tomorrow)
    const justAfterMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1
    )
    const justAfterMidnightDay = toLocalDay(justAfterMidnight)
    const tomorrow = formatLocalDay(justAfterMidnight)

    const meal4 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: justAfterMidnightDay,
        mealName: 'MIDNIGHT_TEST_327_1201AM_TOMORROW',
        portion: 1.0,
        kcal: 250,
        proteinG: 18,
        carbsG: 25,
        fatG: 7,
        source: 'manual',
      }
    })

    results.push({
      test: 'Meal at 12:00:01 AM tomorrow (just after midnight)',
      loggedTime: justAfterMidnight.toISOString(),
      assignedDate: meal4.loggedDate.toISOString().split('T')[0],
      expectedDate: tomorrow,
      pass: meal4.loggedDate.toISOString().split('T')[0] === tomorrow
    })

    // Clean up test data
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { contains: 'MIDNIGHT_TEST_327_' }
      }
    })

    const allPassed = results.every(r => r.pass)

    return NextResponse.json({
      success: true,
      allTestsPassed: allPassed,
      testCount: results.length,
      passedCount: results.filter(r => r.pass).length,
      results,
      summary: {
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        todayLocal: today,
        description: 'Tests verify that meals logged near midnight are assigned to the correct calendar day'
      }
    })
  } catch (error) {
    console.error('Midnight boundary test error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
