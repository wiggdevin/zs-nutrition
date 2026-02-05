import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
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
 * POST /api/plan/swap/undo
 *
 * Undoes the most recent swap for a specific day/slot in the plan.
 * Restores the original meal from the MealSwap history.
 */
export async function POST(req: NextRequest) {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const body = await req.json();
    const { planId, dayNumber, slot } = body;

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

    // Find the most recent swap for this day/slot
    const swapRecord = await prisma.mealSwap.findFirst({
      where: {
        mealPlanId: planId,
        dayNumber,
        slot,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!swapRecord) {
      return NextResponse.json({ error: 'No swap found for this meal' }, { status: 404 });
    }

    // Parse the validated plan
    let validatedPlan: { days: PlanDay[]; [key: string]: unknown };
    try {
      validatedPlan =
        typeof mealPlan.validatedPlan === 'string'
          ? JSON.parse(mealPlan.validatedPlan)
          : (mealPlan.validatedPlan as { days: PlanDay[]; [key: string]: unknown });
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan data' }, { status: 500 });
    }

    // Parse original meal from swap record
    let originalMeal: Meal;
    try {
      originalMeal = JSON.parse(swapRecord.originalMeal);
    } catch {
      return NextResponse.json({ error: 'Failed to parse original meal data' }, { status: 500 });
    }

    // Find the day and restore the original meal
    const dayIdx = validatedPlan.days.findIndex((d: PlanDay) => d.dayNumber === dayNumber);
    if (dayIdx === -1) {
      return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 });
    }

    const day = validatedPlan.days[dayIdx];

    // Find the meal with matching slot
    const mealIdx = day.meals.findIndex((m: Meal) => m.slot === slot);
    if (mealIdx === -1) {
      return NextResponse.json({ error: 'Meal slot not found in plan' }, { status: 404 });
    }

    // Store the current meal (the one we're undoing) before restoring original
    const currentMeal = day.meals[mealIdx];

    // Restore the original meal
    validatedPlan.days[dayIdx].meals[mealIdx] = {
      ...originalMeal,
      slot: slot, // Ensure slot stays the same
    };

    // Delete the swap record and update plan in a transaction
    await prisma.$transaction([
      prisma.mealSwap.delete({
        where: { id: swapRecord.id },
      }),
      prisma.mealPlan.update({
        where: { id: planId },
        data: {
          validatedPlan: JSON.stringify(validatedPlan),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Restored ${originalMeal.name}`,
      restoredMeal: originalMeal,
      removedMeal: currentMeal,
      updatedDay: validatedPlan.days[dayIdx],
    });
  } catch (error) {
    logger.error('Error undoing meal swap:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
