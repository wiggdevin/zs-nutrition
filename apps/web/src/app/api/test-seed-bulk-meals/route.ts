import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

/**
 * POST /api/test-seed-bulk-meals
 * Seeds 120+ tracked meals across various dates for performance testing.
 * Only used in development.
 */
export async function POST() {
  const clerkId = await getClerkUserId()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const mealNames = [
    'Grilled Chicken Breast', 'Brown Rice Bowl', 'Greek Yogurt Parfait',
    'Salmon Fillet', 'Sweet Potato Mash', 'Scrambled Eggs',
    'Overnight Oats', 'Turkey Wrap', 'Caesar Salad',
    'Protein Shake', 'Banana Smoothie', 'Avocado Toast',
    'Quinoa Bowl', 'Steak and Veggies', 'Tuna Sandwich',
    'Chicken Stir Fry', 'Pasta Bolognese', 'Veggie Burger',
    'Egg White Omelette', 'Mixed Nuts Snack',
  ]

  const slots = ['breakfast', 'lunch', 'dinner', 'snack']
  const sources = ['quick_add', 'manual', 'plan_meal', 'fatsecret_search'] as const

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Create 120 meals: 20 today, 100 across past 14 days
  const mealsToCreate = []

  // 20 meals for today (to test dashboard with many today meals)
  for (let i = 0; i < 20; i++) {
    const kcal = 150 + Math.floor(Math.random() * 500)
    const proteinG = 5 + Math.floor(Math.random() * 40)
    const carbsG = 10 + Math.floor(Math.random() * 60)
    const fatG = 2 + Math.floor(Math.random() * 25)

    mealsToCreate.push({
      userId: user.id,
      loggedDate: today,
      mealSlot: slots[i % slots.length],
      mealName: `PERF_TEST_TODAY_${i}_${mealNames[i % mealNames.length]}`,
      portion: 1.0,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: Math.floor(Math.random() * 10),
      source: sources[i % sources.length],
    })
  }

  // 100 meals across past 14 days
  for (let i = 0; i < 100; i++) {
    const daysAgo = 1 + Math.floor(i / 8) // Spread across ~13 days
    const mealDate = new Date(today)
    mealDate.setDate(mealDate.getDate() - daysAgo)

    const kcal = 150 + Math.floor(Math.random() * 500)
    const proteinG = 5 + Math.floor(Math.random() * 40)
    const carbsG = 10 + Math.floor(Math.random() * 60)
    const fatG = 2 + Math.floor(Math.random() * 25)

    mealsToCreate.push({
      userId: user.id,
      loggedDate: mealDate,
      mealSlot: slots[i % slots.length],
      mealName: `PERF_TEST_PAST_${i}_${mealNames[i % mealNames.length]}`,
      portion: 1.0,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: Math.floor(Math.random() * 10),
      source: sources[i % sources.length],
    })
  }

  // Bulk create all meals
  const result = await prisma.trackedMeal.createMany({
    data: mealsToCreate,
  })

  // Also create/update DailyLog entries for today and recent days
  const totalTodayKcal = mealsToCreate
    .filter(m => m.loggedDate.getTime() === today.getTime())
    .reduce((sum, m) => sum + m.kcal, 0)
  const totalTodayProtein = mealsToCreate
    .filter(m => m.loggedDate.getTime() === today.getTime())
    .reduce((sum, m) => sum + m.proteinG, 0)
  const totalTodayCarbs = mealsToCreate
    .filter(m => m.loggedDate.getTime() === today.getTime())
    .reduce((sum, m) => sum + m.carbsG, 0)
  const totalTodayFat = mealsToCreate
    .filter(m => m.loggedDate.getTime() === today.getTime())
    .reduce((sum, m) => sum + m.fatG, 0)

  await prisma.dailyLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: {
      actualKcal: totalTodayKcal,
      actualProteinG: totalTodayProtein,
      actualCarbsG: totalTodayCarbs,
      actualFatG: totalTodayFat,
      adherenceScore: Math.min(100, Math.round((totalTodayKcal / 2200) * 100)),
    },
    create: {
      userId: user.id,
      date: today,
      targetKcal: 2200,
      targetProteinG: 165,
      targetCarbsG: 220,
      targetFatG: 73,
      actualKcal: totalTodayKcal,
      actualProteinG: totalTodayProtein,
      actualCarbsG: totalTodayCarbs,
      actualFatG: totalTodayFat,
      adherenceScore: Math.min(100, Math.round((totalTodayKcal / 2200) * 100)),
    },
  })

  return NextResponse.json({
    success: true,
    totalCreated: result.count,
    todayMeals: 20,
    pastMeals: 100,
    userId: user.id,
  })
}

/**
 * DELETE /api/test-seed-bulk-meals
 * Cleans up performance test data.
 */
export async function DELETE() {
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
      mealName: { startsWith: 'PERF_TEST_' },
    },
  })

  return NextResponse.json({ success: true, deletedMeals: deleted.count })
}
