import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireActiveUser } from '@/lib/auth';
import { mealSwapLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/safe-logger';
import { decompressJson, compressJson } from '@/lib/compression';
import { z } from 'zod';
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '@/lib/api-response';

const MealNutritionSchema = z.object({
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
});

const MealSchema = z
  .object({
    slot: z.string().max(50),
    name: z.string().max(200),
    cuisine: z.string().max(100).optional(),
    prepTimeMin: z.number().min(0).max(1440).optional(),
    cookTimeMin: z.number().min(0).max(1440).optional(),
    nutrition: MealNutritionSchema,
    confidenceLevel: z.string().max(50).optional(),
    ingredients: z
      .array(
        z.object({
          name: z.string().max(200),
          amount: z.string().max(100),
        })
      )
      .optional(),
    instructions: z.array(z.string().max(2000)).optional(),
  })
  .passthrough();

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
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult.reset);
    }

    const body = await req.json();
    const { planId, dayNumber, slot, mealIdx, originalMeal, newMeal } = body;

    if (!planId || !dayNumber || !slot || mealIdx === undefined || !originalMeal || !newMeal) {
      return badRequest('Missing required fields');
    }

    // Validate meal objects against schema
    const originalMealValidation = MealSchema.safeParse(originalMeal);
    if (!originalMealValidation.success) {
      return badRequest('Invalid originalMeal data');
    }
    const newMealValidation = MealSchema.safeParse(newMeal);
    if (!newMealValidation.success) {
      return badRequest('Invalid newMeal data');
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
