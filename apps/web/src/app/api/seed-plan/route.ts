import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * SEED ENDPOINT — Development only.
 * Creates a test user, profile, and active meal plan for testing.
 *
 * POST /api/seed-plan
 */
export async function POST() {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const clerkUserId = 'dev_user_001'

    // Ensure user exists
    let user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      user = await prisma.user.create({
        data: { clerkUserId, email: 'dev@zsnutrition.test' },
      })
    }

    // Ensure profile exists
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    })
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Dev User',
          sex: 'male',
          age: 30,
          heightCm: 177.8,
          weightKg: 81.6,
          goalType: 'cut',
          goalRate: 1,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          mealsPerDay: 3,
          snacksPerDay: 1,
          cookingSkill: 5,
          prepTimeMax: 30,
          macroStyle: 'balanced',
          bmrKcal: 1800,
          tdeeKcal: 2790,
          goalKcal: 2290,
          proteinTargetG: 172,
          carbsTargetG: 229,
          fatTargetG: 76,
        },
      })
    }

    // Deactivate any existing plans
    await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, status: 'replaced' },
    })

    // Create a sample validated plan with realistic meal data
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    // Get current day of week (1=Mon..7=Sun) to ensure today has meals
    const dow = today.getDay()
    const todayDayNumber = dow === 0 ? 7 : dow

    const validatedPlan = {
      days: Array.from({ length: 7 }, (_, i) => ({
        dayNumber: i + 1,
        dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
        isTrainingDay: [1, 3, 5].includes(i + 1),
        targetKcal: 2290,
        meals: [
          {
            slot: 'breakfast',
            name: i + 1 === todayDayNumber ? 'Greek Yogurt Protein Bowl' : `Day ${i + 1} Breakfast`,
            cuisine: 'american',
            prepTimeMin: 5,
            cookTimeMin: 0,
            nutrition: { kcal: 420, proteinG: 38, carbsG: 42, fatG: 12, fiberG: 4 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Greek yogurt', amount: '200g' },
              { name: 'Protein powder', amount: '1 scoop' },
              { name: 'Mixed berries', amount: '100g' },
              { name: 'Granola', amount: '30g' },
            ],
            instructions: ['Add yogurt to bowl', 'Mix in protein powder', 'Top with berries and granola'],
          },
          {
            slot: 'lunch',
            name: i + 1 === todayDayNumber ? 'Grilled Chicken & Quinoa Salad' : `Day ${i + 1} Lunch`,
            cuisine: 'mediterranean',
            prepTimeMin: 15,
            cookTimeMin: 10,
            nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16, fiberG: 8 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken breast', amount: '200g' },
              { name: 'Quinoa', amount: '100g dry' },
              { name: 'Mixed greens', amount: '100g' },
              { name: 'Cherry tomatoes', amount: '80g' },
              { name: 'Olive oil', amount: '1 tbsp' },
            ],
            instructions: ['Cook quinoa', 'Grill chicken', 'Assemble salad', 'Drizzle with olive oil'],
          },
          {
            slot: 'dinner',
            name: i + 1 === todayDayNumber ? 'Salmon with Roasted Vegetables' : `Day ${i + 1} Dinner`,
            cuisine: 'american',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: { kcal: 620, proteinG: 42, carbsG: 38, fatG: 28, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Salmon fillet', amount: '200g' },
              { name: 'Broccoli', amount: '150g' },
              { name: 'Sweet potato', amount: '150g' },
              { name: 'Olive oil', amount: '1 tbsp' },
            ],
            instructions: ['Preheat oven to 400°F', 'Season salmon', 'Roast vegetables', 'Bake salmon 15 min'],
          },
          {
            slot: 'snack',
            name: i + 1 === todayDayNumber ? 'Protein Shake & Almonds' : `Day ${i + 1} Snack`,
            cuisine: 'american',
            prepTimeMin: 2,
            cookTimeMin: 0,
            nutrition: { kcal: 320, proteinG: 32, carbsG: 18, fatG: 14, fiberG: 3 },
            confidenceLevel: 'ai_estimated',
            ingredients: [
              { name: 'Protein powder', amount: '1.5 scoops' },
              { name: 'Almond milk', amount: '300ml' },
              { name: 'Almonds', amount: '20g' },
            ],
            instructions: ['Blend protein powder with almond milk', 'Serve with almonds on the side'],
          },
        ],
      })),
      groceryList: [
        {
          category: 'Dairy & Eggs',
          items: [
            { name: 'Greek yogurt', amount: 1400, unit: 'g' },
          ],
        },
        {
          category: 'Fruits',
          items: [
            { name: 'Mixed berries', amount: 700, unit: 'g' },
          ],
        },
        {
          category: 'Grains & Bread',
          items: [
            { name: 'Granola', amount: 210, unit: 'g' },
            { name: 'Quinoa', amount: 700, unit: 'g' },
          ],
        },
        {
          category: 'Meat & Seafood',
          items: [
            { name: 'Chicken breast', amount: 1400, unit: 'g' },
            { name: 'Salmon fillet', amount: 1400, unit: 'g' },
          ],
        },
        {
          category: 'Nuts & Seeds',
          items: [
            { name: 'Almonds', amount: 140, unit: 'g' },
          ],
        },
        {
          category: 'Oils & Condiments',
          items: [
            { name: 'Olive oil', amount: 14, unit: 'tbsp' },
          ],
        },
        {
          category: 'Other',
          items: [
            { name: 'Almond milk', amount: 2100, unit: 'ml' },
            { name: 'Protein powder', amount: 18, unit: 'scoops' },
          ],
        },
        {
          category: 'Produce',
          items: [
            { name: 'Broccoli', amount: 1050, unit: 'g' },
            { name: 'Cherry tomatoes', amount: 560, unit: 'g' },
            { name: 'Mixed greens', amount: 700, unit: 'g' },
            { name: 'Sweet potato', amount: 1050, unit: 'g' },
          ],
        },
      ],
      qa: { status: 'PASS', score: 92, iterations: 1 },
      weeklyTotals: { avgKcal: 1940, avgProteinG: 160, avgCarbsG: 150, avgFatG: 70 },
    }

    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        validatedPlan: JSON.stringify(validatedPlan),
        metabolicProfile: JSON.stringify({
          bmrKcal: 1800,
          tdeeKcal: 2790,
          goalKcal: 2290,
          proteinTargetG: 172,
          carbsTargetG: 229,
          fatTargetG: 76,
        }),
        dailyKcalTarget: 2290,
        dailyProteinG: 172,
        dailyCarbsG: 229,
        dailyFatG: 76,
        trainingBonusKcal: 200,
        planDays: 7,
        startDate,
        endDate,
        qaScore: 92,
        qaStatus: 'PASS',
        status: 'active',
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      profileId: profile.id,
      planId: plan.id,
      message: 'Seed data created. Visit /dashboard to see the meal plan.',
    })
  } catch (error) {
    safeLogError('Seed error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
