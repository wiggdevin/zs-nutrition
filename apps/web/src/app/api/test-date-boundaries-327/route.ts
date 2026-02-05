import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { toLocalDay, parseLocalDay, formatLocalDay } from '@/lib/date-utils'

/**
 * POST /api/test-date-boundaries-327
 *
 * Test endpoint to verify date boundary handling for Feature #327.
 *
 * This test simulates logging meals near midnight to verify they are
 * assigned to the correct day based on local time.
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

    const body = await request.json()
    const { action } = body

    // Clean up any existing test data
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { contains: 'TEST_327_DATE_BOUNDARY_' }
      }
    })

    const results: any[] = []
    const now = new Date()

    // Test 1: Create a meal for today using local time
    const todayLocal = toLocalDay(now)
    const testMeal1 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: todayLocal,
        mealName: 'TEST_327_DATE_BOUNDARY_TODAY',
        portion: 1.0,
        kcal: 500,
        proteinG: 30,
        carbsG: 40,
        fatG: 15,
        source: 'manual',
      }
    })
    results.push({
      test: 'Create meal for today',
      input: formatLocalDay(now),
      storedLoggedDate: testMeal1.loggedDate.toISOString(),
      storedLoggedDatePart: testMeal1.loggedDate.toISOString().split('T')[0],
      expected: formatLocalDay(now),
      pass: testMeal1.loggedDate.toISOString().split('T')[0] === formatLocalDay(now)
    })

    // Test 2: Create a meal for yesterday
    const yesterday = toLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))
    const testMeal2 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: yesterday,
        mealName: 'TEST_327_DATE_BOUNDARY_YESTERDAY',
        portion: 1.0,
        kcal: 600,
        proteinG: 35,
        carbsG: 50,
        fatG: 20,
        source: 'manual',
      }
    })
    results.push({
      test: 'Create meal for yesterday',
      input: formatLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      storedLoggedDate: testMeal2.loggedDate.toISOString(),
      storedLoggedDatePart: testMeal2.loggedDate.toISOString().split('T')[0],
      expected: formatLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      pass: testMeal2.loggedDate.toISOString().split('T')[0] === formatLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))
    })

    // Test 3: Query meals for today
    const todayMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: todayLocal
      }
    })
    results.push({
      test: 'Query meals for today',
      queryDate: formatLocalDay(now),
      found: todayMeals.length,
      expected: 1,
      pass: todayMeals.length === 1
    })

    // Test 4: Query meals for yesterday
    const yesterdayMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: yesterday
      }
    })
    results.push({
      test: 'Query meals for yesterday',
      queryDate: formatLocalDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      found: yesterdayMeals.length,
      expected: 1,
      pass: yesterdayMeals.length === 1
    })

    // Test 5: Verify parsing ISO date string
    const testDateStr = '2025-02-03'
    const parsedDate = parseLocalDay(testDateStr)
    results.push({
      test: 'Parse ISO date string',
      input: testDateStr,
      parsed: parsedDate.toISOString(),
      parsedDatePart: parsedDate.toISOString().split('T')[0],
      expected: '2025-02-03',
      pass: parsedDate.toISOString().split('T')[0] === testDateStr
    })

    // Test 6: Verify formatLocalDay
    const testFormatDate = new Date('2025-02-03T15:30:00Z')
    const formatted = formatLocalDay(testFormatDate)
    results.push({
      test: 'Format date to ISO string',
      input: '2025-02-03T15:30:00Z',
      formatted: formatted,
      expected: '2025-02-03',
      pass: formatted === '2025-02-03'
    })

    // Test 7: Simulate a meal logged at 11:30 PM local time
    // Create a date that represents 11:30 PM today in local time
    const lateNightLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      30,
      0
    )
    const lateNightLocalDay = toLocalDay(lateNightLocal)
    const testMeal3 = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        loggedDate: lateNightLocalDay,
        mealName: 'TEST_327_DATE_BOUNDARY_LATE_NIGHT',
        portion: 1.0,
        kcal: 400,
        proteinG: 25,
        carbsG: 35,
        fatG: 10,
        source: 'manual',
      }
    })
    results.push({
      test: 'Meal logged at 11:30 PM local time',
      localTime: lateNightLocal.toISOString(),
      assignedDay: testMeal3.loggedDate.toISOString().split('T')[0],
      expectedDay: formatLocalDay(now),
      pass: testMeal3.loggedDate.toISOString().split('T')[0] === formatLocalDay(now)
    })

    // Clean up test data
    await prisma.trackedMeal.deleteMany({
      where: {
        userId: user.id,
        mealName: { contains: 'TEST_327_DATE_BOUNDARY_' }
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
        serverLocalTime: now.toLocaleString(),
        serverUTC: now.toISOString(),
        todayLocal: todayLocal.toISOString(),
        todayLocalFormatted: formatLocalDay(now)
      }
    })
  } catch (error) {
    console.error('Date boundary test error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
