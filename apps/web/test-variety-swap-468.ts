/**
 * Test script for Feature #468: Meal swap excludes current plan meals
 *
 * This creates a plan where:
 * - Day 2 has "Day 1 Lunch" as a DINNER meal (same name, different slot)
 * - When swapping Day 2 breakfast, "Day 1 Lunch" should NOT be offered as an alternative
 *   because it already exists on Day 2 (even though it's in a different slot)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'

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

    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    // Create a test plan where Day 2 has a meal with the same name as a meal from Day 1
    // This tests that swap alternatives exclude ALL meals from the current day, not just the same slot
    const validatedPlan = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: true,
          targetKcal: 2290,
          meals: [
            {
              slot: 'breakfast',
              name: 'Day 1 Breakfast UNIQUE',
              cuisine: 'american',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 420, proteinG: 38, carbsG: 42, fatG: 12 },
            },
            {
              slot: 'lunch',
              name: 'Day 1 Lunch UNIQUE',
              cuisine: 'mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16 },
            },
            {
              slot: 'dinner',
              name: 'Day 1 Dinner UNIQUE',
              cuisine: 'american',
              prepTimeMin: 10,
              cookTimeMin: 25,
              nutrition: { kcal: 620, proteinG: 42, carbsG: 38, fatG: 28 },
            },
            {
              slot: 'snack',
              name: 'Day 1 Snack UNIQUE',
              cuisine: 'american',
              prepTimeMin: 2,
              cookTimeMin: 0,
              nutrition: { kcal: 320, proteinG: 32, carbsG: 18, fatG: 14 },
            },
          ],
        },
        {
          dayNumber: 2,
          dayName: 'Tuesday',
          isTrainingDay: false,
          targetKcal: 2290,
          meals: [
            {
              slot: 'breakfast',
              name: 'Day 2 Breakfast UNIQUE',
              cuisine: 'american',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 420, proteinG: 38, carbsG: 42, fatG: 12 },
            },
            {
              slot: 'lunch',
              name: 'Day 2 Lunch UNIQUE',
              cuisine: 'mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16 },
            },
            // KEY TEST: Dinner has the SAME NAME as Day 1's lunch
            // When swapping Day 2 breakfast, this should NOT appear as an alternative
            {
              slot: 'dinner',
              name: 'Day 1 Lunch UNIQUE', // DUPLICATE NAME from Day 1 lunch
              cuisine: 'mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16 },
            },
            {
              slot: 'snack',
              name: 'Day 2 Snack UNIQUE',
              cuisine: 'american',
              prepTimeMin: 2,
              cookTimeMin: 0,
              nutrition: { kcal: 320, proteinG: 32, carbsG: 18, fatG: 14 },
            },
          ],
        },
        {
          dayNumber: 3,
          dayName: 'Wednesday',
          isTrainingDay: true,
          targetKcal: 2290,
          meals: [
            {
              slot: 'breakfast',
              name: 'Day 3 Breakfast UNIQUE',
              cuisine: 'american',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 420, proteinG: 38, carbsG: 42, fatG: 12 },
            },
            {
              slot: 'lunch',
              name: 'Day 3 Lunch UNIQUE',
              cuisine: 'mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16 },
            },
            {
              slot: 'dinner',
              name: 'Day 3 Dinner UNIQUE',
              cuisine: 'american',
              prepTimeMin: 10,
              cookTimeMin: 25,
              nutrition: { kcal: 620, proteinG: 42, carbsG: 38, fatG: 28 },
            },
            {
              slot: 'snack',
              name: 'Day 3 Snack UNIQUE',
              cuisine: 'american',
              prepTimeMin: 2,
              cookTimeMin: 0,
              nutrition: { kcal: 320, proteinG: 32, carbsG: 18, fatG: 14 },
            },
          ],
        },
        // Add remaining days...
        ...[4, 5, 6, 7].map((i) => ({
          dayNumber: i,
          dayName: ['Thursday', 'Friday', 'Saturday', 'Sunday'][i - 4],
          isTrainingDay: [5].includes(i),
          targetKcal: 2290,
          meals: [
            {
              slot: 'breakfast',
              name: `Day ${i} Breakfast UNIQUE`,
              cuisine: 'american',
              prepTimeMin: 5,
              cookTimeMin: 0,
              nutrition: { kcal: 420, proteinG: 38, carbsG: 42, fatG: 12 },
            },
            {
              slot: 'lunch',
              name: `Day ${i} Lunch UNIQUE`,
              cuisine: 'mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 10,
              nutrition: { kcal: 580, proteinG: 48, carbsG: 52, fatG: 16 },
            },
            {
              slot: 'dinner',
              name: `Day ${i} Dinner UNIQUE`,
              cuisine: 'american',
              prepTimeMin: 10,
              cookTimeMin: 25,
              nutrition: { kcal: 620, proteinG: 42, carbsG: 38, fatG: 28 },
            },
            {
              slot: 'snack',
              name: `Day ${i} Snack UNIQUE`,
              cuisine: 'american',
              prepTimeMin: 2,
              cookTimeMin: 0,
              nutrition: { kcal: 320, proteinG: 32, carbsG: 18, fatG: 14 },
            },
          ],
        })),
      ],
      groceryList: [],
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
      planId: plan.id,
      message: 'Test plan created for Feature #468',
      testScenario: {
        day2Meals: ['Day 2 Breakfast UNIQUE', 'Day 2 Lunch UNIQUE', 'Day 1 Lunch UNIQUE', 'Day 2 Snack UNIQUE'],
        testInstructions: 'Swap Day 2 breakfast. "Day 1 Lunch UNIQUE" should NOT appear in alternatives because it already exists on Day 2 (as dinner).',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
