import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * POST /api/log-meal
 * Log a meal from the plan. Creates TrackedMeal and updates DailyLog.
 */
export async function POST(request: Request) {
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

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const {
      planId,
      dayNumber,
      slot,
      mealName,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      portion = 1.0,
    } = body;

    if (!planId || !mealName || calories === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify plan belongs to user
    const plan = await prisma.mealPlan.findFirst({
      where: { id: planId, userId: user.id },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const today = new Date();
    const dateOnly = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    // Apply portion multiplier
    const kcal = Math.round(calories * portion);
    const proteinG = Math.round((protein || 0) * portion * 10) / 10;
    const carbsG = Math.round((carbs || 0) * portion * 10) / 10;
    const fatG = Math.round((fat || 0) * portion * 10) / 10;
    const fiberG = fiber ? Math.round(fiber * portion * 10) / 10 : null;

    // Use a transaction with duplicate detection to prevent race conditions.
    // The unique constraint on TrackedMeal (userId, mealPlanId, loggedDate, mealSlot, source)
    // acts as the ultimate guard for plan meals.
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Duplicate detection: check if same plan meal was already logged today
        const existingEntry = await tx.trackedMeal.findFirst({
          where: {
            userId: user.id,
            mealPlanId: planId,
            loggedDate: dateOnly,
            mealSlot: slot || null,
            source: 'plan_meal',
          },
        });

        if (existingEntry) {
          // Return existing entry (idempotent response)
          const existingDailyLog = await tx.dailyLog.findUnique({
            where: { userId_date: { userId: user.id, date: dateOnly } },
          });
          return {
            success: true,
            duplicate: true,
            trackedMeal: {
              id: existingEntry.id,
              mealName: existingEntry.mealName,
              mealSlot: existingEntry.mealSlot,
              kcal: existingEntry.kcal,
              proteinG: existingEntry.proteinG,
              carbsG: existingEntry.carbsG,
              fatG: existingEntry.fatG,
              source: existingEntry.source,
            },
            dailyLog: {
              actualKcal: existingDailyLog?.actualKcal ?? existingEntry.kcal,
              actualProteinG:
                existingDailyLog?.actualProteinG ?? Math.round(existingEntry.proteinG),
              actualCarbsG: existingDailyLog?.actualCarbsG ?? Math.round(existingEntry.carbsG),
              actualFatG: existingDailyLog?.actualFatG ?? Math.round(existingEntry.fatG),
              targetKcal: existingDailyLog?.targetKcal ?? null,
              targetProteinG: existingDailyLog?.targetProteinG ?? null,
              targetCarbsG: existingDailyLog?.targetCarbsG ?? null,
              targetFatG: existingDailyLog?.targetFatG ?? null,
              adherenceScore: existingDailyLog?.adherenceScore ?? 0,
            },
          };
        }

        // Create TrackedMeal with source='plan_meal'
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: user.id,
            mealPlanId: planId,
            loggedDate: dateOnly,
            mealSlot: slot || null,
            mealName,
            portion,
            kcal,
            proteinG,
            carbsG,
            fatG,
            fiberG,
            source: 'plan_meal',
            confidenceScore: 0.95,
          },
        });

        // Update or create DailyLog
        let dailyLog = await tx.dailyLog.findUnique({
          where: {
            userId_date: { userId: user.id, date: dateOnly },
          },
        });

        if (!dailyLog) {
          dailyLog = await tx.dailyLog.create({
            data: {
              userId: user.id,
              date: dateOnly,
              targetKcal: plan.dailyKcalTarget || 2290,
              targetProteinG: plan.dailyProteinG || 172,
              targetCarbsG: plan.dailyCarbsG || 229,
              targetFatG: plan.dailyFatG || 76,
              actualKcal: kcal,
              actualProteinG: Math.round(proteinG),
              actualCarbsG: Math.round(carbsG),
              actualFatG: Math.round(fatG),
            },
          });
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + kcal,
              actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
              actualFatG: dailyLog.actualFatG + Math.round(fatG),
            },
          });
        }

        // Calculate adherence score
        const targetKcal = dailyLog.targetKcal || 2290;
        const adherenceScore =
          targetKcal > 0 ? Math.min(100, Math.round((dailyLog.actualKcal / targetKcal) * 100)) : 0;

        await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        });

        return {
          success: true,
          trackedMeal: {
            id: trackedMeal.id,
            mealName: trackedMeal.mealName,
            mealSlot: trackedMeal.mealSlot,
            kcal: trackedMeal.kcal,
            proteinG: trackedMeal.proteinG,
            carbsG: trackedMeal.carbsG,
            fatG: trackedMeal.fatG,
            source: trackedMeal.source,
          },
          dailyLog: {
            actualKcal: dailyLog.actualKcal,
            actualProteinG: dailyLog.actualProteinG,
            actualCarbsG: dailyLog.actualCarbsG,
            actualFatG: dailyLog.actualFatG,
            targetKcal: dailyLog.targetKcal,
            targetProteinG: dailyLog.targetProteinG,
            targetCarbsG: dailyLog.targetCarbsG,
            targetFatG: dailyLog.targetFatG,
            adherenceScore,
          },
        };
      });

      return NextResponse.json(result);
    } catch (error) {
      // Handle unique constraint violation (race condition: concurrent identical requests)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.trackedMeal.findFirst({
          where: {
            userId: user.id,
            mealPlanId: planId,
            loggedDate: dateOnly,
            mealSlot: slot || null,
            source: 'plan_meal',
          },
        });
        if (existing) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            trackedMeal: {
              id: existing.id,
              mealName: existing.mealName,
              mealSlot: existing.mealSlot,
              kcal: existing.kcal,
              proteinG: existing.proteinG,
              carbsG: existing.carbsG,
              fatG: existing.fatG,
              source: existing.source,
            },
          });
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Log meal error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
