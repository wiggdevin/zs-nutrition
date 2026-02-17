import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireActiveUser } from '@/lib/auth';
import { calculateAdherenceScore } from '@/lib/adherence';
import { logger } from '@/lib/safe-logger';
import { toLocalDay } from '@/lib/date-utils';
import { decompressJson } from '@/lib/compression';

export async function POST(request: NextRequest) {
  try {
    let clerkUserId: string;
    let _dbUserId: string;
    try {
      ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { planId, dayNumber, slot, portion: portionInput } = body;
    const portion = typeof portionInput === 'number' && portionInput > 0 ? portionInput : 1.0;

    if (!planId || !dayNumber || !slot) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, dayNumber, slot' },
        { status: 400 }
      );
    }

    // Get the meal plan (exclude soft-deleted)
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { id: planId, userId: user.id, deletedAt: null },
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Decompress validatedPlan (handles both compressed and legacy uncompressed data)
    const validatedPlan = decompressJson<{
      days?: Array<{
        dayNumber: number;
        meals?: Array<{
          slot: string;
          name: string;
          nutrition: {
            kcal: number;
            proteinG: number;
            carbsG: number;
            fatG: number;
            fiberG?: number;
          };
          confidenceLevel?: string;
        }>;
      }>;
    }>(mealPlan.validatedPlan);
    const day = validatedPlan?.days?.find((d) => d.dayNumber === dayNumber);

    if (!day) {
      return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 });
    }

    const meal = day.meals?.find(
      (m: { slot: string }) => m.slot.toLowerCase() === slot.toLowerCase()
    );

    if (!meal) {
      return NextResponse.json({ error: 'Meal not found in plan day' }, { status: 404 });
    }

    // Create today's date at midnight (local time, stored as UTC midnight)
    const today = toLocalDay();

    // Use a serialized transaction to prevent race conditions from concurrent requests.
    // The unique constraint on TrackedMeal (userId, mealPlanId, loggedDate, mealSlot, source)
    // acts as the database-level guard against duplicates that slip past the app-level check.
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Check for duplicate: same user, same plan, same slot, same day
        const existingLog = await tx.trackedMeal.findFirst({
          where: {
            userId: user.id,
            mealPlanId: planId,
            mealSlot: meal.slot,
            loggedDate: today,
            source: 'plan_meal',
          },
        });

        if (existingLog) {
          // Return the existing entry instead of creating a duplicate (idempotent)
          return {
            success: true,
            duplicate: true,
            trackedMeal: {
              id: existingLog.id,
              name: existingLog.mealName,
              calories: existingLog.kcal,
              protein: existingLog.proteinG,
              carbs: existingLog.carbsG,
              fat: existingLog.fatG,
              portion: existingLog.portion || 1.0,
              source: existingLog.source,
              mealSlot: existingLog.mealSlot,
            },
          };
        }

        // Apply portion multiplier to nutrition
        const adjustedKcal = Math.round(meal.nutrition.kcal * portion);
        const adjustedProteinG = Math.round(meal.nutrition.proteinG * portion * 10) / 10;
        const adjustedCarbsG = Math.round(meal.nutrition.carbsG * portion * 10) / 10;
        const adjustedFatG = Math.round(meal.nutrition.fatG * portion * 10) / 10;
        const adjustedFiberG = meal.nutrition.fiberG
          ? Math.round(meal.nutrition.fiberG * portion * 10) / 10
          : null;

        // Create the TrackedMeal with source 'plan_meal'
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: user.id,
            mealPlanId: planId,
            loggedDate: today,
            mealSlot: meal.slot,
            mealName: meal.name,
            portion,
            kcal: adjustedKcal,
            proteinG: adjustedProteinG,
            carbsG: adjustedCarbsG,
            fatG: adjustedFatG,
            fiberG: adjustedFiberG,
            source: 'plan_meal',
            confidenceScore: meal.confidenceLevel === 'verified' ? 1.0 : 0.7,
          },
        });

        // Update or create DailyLog with new totals
        const dailyLog = await tx.dailyLog.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: today,
            },
          },
          create: {
            userId: user.id,
            date: today,
            targetKcal: mealPlan.dailyKcalTarget,
            targetProteinG: mealPlan.dailyProteinG,
            targetCarbsG: mealPlan.dailyCarbsG,
            targetFatG: mealPlan.dailyFatG,
            actualKcal: adjustedKcal,
            actualProteinG: Math.round(adjustedProteinG),
            actualCarbsG: Math.round(adjustedCarbsG),
            actualFatG: Math.round(adjustedFatG),
          },
          update: {
            actualKcal: { increment: adjustedKcal },
            actualProteinG: { increment: Math.round(adjustedProteinG) },
            actualCarbsG: { increment: Math.round(adjustedCarbsG) },
            actualFatG: { increment: Math.round(adjustedFatG) },
          },
        });

        // Calculate weighted adherence score
        const adherenceScore = calculateAdherenceScore(dailyLog);

        // Update adherence score
        await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        });

        return {
          success: true,
          trackedMeal: {
            id: trackedMeal.id,
            name: trackedMeal.mealName,
            calories: trackedMeal.kcal,
            protein: trackedMeal.proteinG,
            carbs: trackedMeal.carbsG,
            fat: trackedMeal.fatG,
            portion: trackedMeal.portion,
            source: trackedMeal.source,
            mealSlot: trackedMeal.mealSlot,
          },
          dailyLog: {
            actualKcal: dailyLog.actualKcal,
            actualProteinG: dailyLog.actualProteinG,
            actualCarbsG: dailyLog.actualCarbsG,
            actualFatG: dailyLog.actualFatG,
            adherenceScore,
          },
        };
      });
    } catch (error) {
      // Handle unique constraint violation (race condition: two identical requests
      // both passed the duplicate check before either wrote to the database)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.trackedMeal.findFirst({
          where: {
            userId: user.id,
            mealPlanId: planId,
            mealSlot: meal.slot,
            loggedDate: today,
            source: 'plan_meal',
          },
        });
        if (existing) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            trackedMeal: {
              id: existing.id,
              name: existing.mealName,
              calories: existing.kcal,
              protein: existing.proteinG,
              carbs: existing.carbsG,
              fat: existing.fatG,
              portion: existing.portion || 1.0,
              source: existing.source,
              mealSlot: existing.mealSlot,
            },
          });
        }
      }
      throw error;
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Log from plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
