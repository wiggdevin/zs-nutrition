import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireActiveUser } from '@/lib/auth';
import { mealSwapLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/safe-logger';
import { decompressJson, compressJson } from '@/lib/compression';
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '@/lib/api-response';

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
    let clerkUserId: string;
    let _dbUserId: string;
    try {
      ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      return message === 'Account is deactivated' ? forbidden(message) : unauthorized(message);
    }

    // Rate limit: 10 meal swaps per hour per user
    const rateLimitResult = await checkRateLimit(mealSwapLimiter, clerkUserId);
    if (rateLimitResult && !rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult.reset);
    }

    const body = await req.json();
    const { planId, dayNumber, slot, mealIdx, originalMeal, newMeal } = body;

    if (!planId || !dayNumber || !slot || mealIdx === undefined || !originalMeal || !newMeal) {
      return badRequest('Missing required fields');
    }

    // Verify user owns this plan
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return notFound('User not found');
    }

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        userId: user.id,
        deletedAt: null, // Exclude soft-deleted plans
      },
    });

    if (!mealPlan) {
      return notFound('Meal plan not found');
    }

    // Decompress validatedPlan (handles both compressed and legacy uncompressed data)
    const validatedPlan = decompressJson<{ days: PlanDay[]; [key: string]: unknown }>(
      mealPlan.validatedPlan
    );
    if (!validatedPlan?.days) {
      return serverError('Invalid plan data');
    }

    // Find the day and replace the meal
    const dayIdx = validatedPlan.days.findIndex((d: PlanDay) => d.dayNumber === dayNumber);
    if (dayIdx === -1) {
      return notFound('Day not found in plan');
    }

    const day = validatedPlan.days[dayIdx];
    if (mealIdx < 0 || mealIdx >= day.meals.length) {
      return badRequest('Invalid meal index');
    }

    // Replace the meal in the plan
    validatedPlan.days[dayIdx].meals[mealIdx] = {
      ...newMeal,
      slot: slot, // Ensure slot stays the same
    };

    // Save MealSwap record and update plan in a transaction
    // Re-compress validatedPlan for storage optimization
    const recompressedPlan = compressJson(validatedPlan);
    await prisma.$transaction([
      prisma.mealSwap.create({
        data: {
          mealPlanId: planId,
          dayNumber,
          slot,
          originalMeal: originalMeal as Prisma.InputJsonValue,
          newMeal: newMeal as Prisma.InputJsonValue,
        },
      }),
      prisma.mealPlan.update({
        where: { id: planId },
        data: {
          validatedPlan: recompressedPlan as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return apiSuccess({
      success: true,
      message: `Swapped ${originalMeal.name} with ${newMeal.name}`,
      updatedDay: validatedPlan.days[dayIdx],
    });
  } catch (error) {
    logger.error('Error swapping meal:', error);
    return serverError();
  }
}
