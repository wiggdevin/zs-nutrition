import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface Meal {
  slot: string;
  name: string;
  cuisine?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  nutrition: MealNutrition;
  confidenceLevel?: string;
}

interface PlanDay {
  dayNumber: number;
  meals: Meal[];
}

/**
 * POST /api/plan/swap/alternatives
 *
 * Returns alternative meals for a given slot by looking at other days
 * in the plan that have the same meal slot.
 */
export async function POST(req: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planId, dayNumber, slot, currentMealName } = body;

    if (!planId || !dayNumber || !slot) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user owns this plan
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        userId: user.id,
      },
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Parse the validated plan
    let validatedPlan: { days: PlanDay[] };
    try {
      validatedPlan = typeof mealPlan.validatedPlan === 'string'
        ? JSON.parse(mealPlan.validatedPlan)
        : mealPlan.validatedPlan as { days: PlanDay[] };
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan data' }, { status: 500 });
    }

    // Find the current day to collect all meals on that day (for variety exclusion)
    const currentDay = (validatedPlan.days || []).find(d => d.dayNumber === dayNumber);
    const currentDayMealNames = new Set<string>();
    if (currentDay?.meals) {
      for (const meal of currentDay.meals) {
        currentDayMealNames.add(meal.name.toLowerCase());
      }
    }

    // Collect alternative meals from other days with the same slot
    // Exclude meals that are already on the current day to ensure variety
    const alternatives: Meal[] = [];
    const seenNames = new Set<string>();
    if (currentMealName) {
      seenNames.add(currentMealName.toLowerCase());
    }

    for (const day of (validatedPlan.days || [])) {
      if (day.dayNumber === dayNumber) continue;
      for (const meal of (day.meals || [])) {
        if (
          meal.slot?.toLowerCase() === slot.toLowerCase() &&
          !seenNames.has(meal.name.toLowerCase()) &&
          !currentDayMealNames.has(meal.name.toLowerCase()) // Exclude meals already on current day
        ) {
          seenNames.add(meal.name.toLowerCase());
          alternatives.push({
            slot: meal.slot,
            name: meal.name,
            cuisine: meal.cuisine,
            prepTimeMin: meal.prepTimeMin,
            cookTimeMin: meal.cookTimeMin,
            nutrition: meal.nutrition,
            confidenceLevel: meal.confidenceLevel || 'ai_estimated',
          });
        }
      }
    }

    return NextResponse.json({ alternatives });
  } catch (error) {
    safeLogError('Error fetching swap alternatives:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
