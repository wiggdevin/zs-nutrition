import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { checkRateLimit, addRateLimitHeaders, rateLimitExceededResponse, RATE_LIMITS } from '@/lib/rate-limit';
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
  ingredients?: Array<{ name: string; amount: string }>;
  instructions?: string[];
}

interface PlanDay {
  dayNumber: number;
  dayName: string;
  isTrainingDay: boolean;
  targetKcal: number;
  meals: Meal[];
}

/**
 * POST /api/plan/swap
 *
 * Swaps a meal in the plan with a new meal.
 * Records the swap in the MealSwap table and updates the validatedPlan JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 meal swaps per hour per user
    const rateLimitResult = checkRateLimit(clerkUserId, RATE_LIMITS.mealSwap);
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult, RATE_LIMITS.mealSwap);
    }

    const body = await req.json();
    const { planId, dayNumber, slot, mealIdx, originalMeal, newMeal } = body;

    if (!planId || !dayNumber || !slot || mealIdx === undefined || !originalMeal || !newMeal) {
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
    let validatedPlan: { days: PlanDay[]; [key: string]: unknown };
    try {
      validatedPlan = typeof mealPlan.validatedPlan === 'string'
        ? JSON.parse(mealPlan.validatedPlan)
        : mealPlan.validatedPlan as { days: PlanDay[]; [key: string]: unknown };
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan data' }, { status: 500 });
    }

    // Find the day and replace the meal
    const dayIdx = validatedPlan.days.findIndex((d: PlanDay) => d.dayNumber === dayNumber);
    if (dayIdx === -1) {
      return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 });
    }

    const day = validatedPlan.days[dayIdx];
    if (mealIdx < 0 || mealIdx >= day.meals.length) {
      return NextResponse.json({ error: 'Invalid meal index' }, { status: 400 });
    }

    // Replace the meal in the plan
    validatedPlan.days[dayIdx].meals[mealIdx] = {
      ...newMeal,
      slot: slot, // Ensure slot stays the same
    };

    // Save MealSwap record and update plan in a transaction
    await prisma.$transaction([
      prisma.mealSwap.create({
        data: {
          mealPlanId: planId,
          dayNumber,
          slot,
          originalMeal: JSON.stringify(originalMeal),
          newMeal: JSON.stringify(newMeal),
        },
      }),
      prisma.mealPlan.update({
        where: { id: planId },
        data: {
          validatedPlan: JSON.stringify(validatedPlan),
        },
      }),
    ]);

    const response = NextResponse.json({
      success: true,
      message: `Swapped ${originalMeal.name} with ${newMeal.name}`,
      updatedDay: validatedPlan.days[dayIdx],
    });
    addRateLimitHeaders(response, rateLimitResult);
    return response;
  } catch (error) {
    safeLogError('Error swapping meal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
