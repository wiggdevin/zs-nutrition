import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

/**
 * POST /api/log-meal/manual
 * Log a manually entered food with custom nutrition data.
 * Creates TrackedMeal with source='manual' and updates DailyLog.
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
    const { foodName, calories, protein, carbs, fat, mealSlot } = body;

    // Validate required fields
    if (!foodName || typeof foodName !== 'string' || foodName.trim().length === 0) {
      return NextResponse.json({ error: 'Food name is required' }, { status: 400 });
    }
    if (
      calories === undefined ||
      calories === null ||
      isNaN(Number(calories)) ||
      Number(calories) < 0
    ) {
      return NextResponse.json({ error: 'Valid calories value is required' }, { status: 400 });
    }

    const kcal = Math.round(Number(calories));
    const proteinG = Math.round((Number(protein) || 0) * 10) / 10;
    const carbsG = Math.round((Number(carbs) || 0) * 10) / 10;
    const fatG = Math.round((Number(fat) || 0) * 10) / 10;

    const today = new Date();
    const dateOnly = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    // Use a transaction with duplicate detection to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Duplicate detection: check if an identical manual entry was logged in the last 3 seconds
      const threeSecondsAgo = new Date(Date.now() - 3000);
      const recentDuplicate = await tx.trackedMeal.findFirst({
        where: {
          userId: user.id,
          loggedDate: dateOnly,
          mealName: foodName.trim(),
          kcal,
          source: 'manual',
          createdAt: { gte: threeSecondsAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentDuplicate) {
        const existingDailyLog = await tx.dailyLog.findUnique({
          where: { userId_date: { userId: user.id, date: dateOnly } },
        });
        return {
          success: true,
          duplicate: true,
          trackedMeal: {
            id: recentDuplicate.id,
            mealName: recentDuplicate.mealName,
            mealSlot: recentDuplicate.mealSlot,
            kcal: recentDuplicate.kcal,
            proteinG: recentDuplicate.proteinG,
            carbsG: recentDuplicate.carbsG,
            fatG: recentDuplicate.fatG,
            source: recentDuplicate.source,
          },
          dailyLog: {
            actualKcal: existingDailyLog?.actualKcal ?? recentDuplicate.kcal,
            actualProteinG:
              existingDailyLog?.actualProteinG ?? Math.round(recentDuplicate.proteinG),
            actualCarbsG: existingDailyLog?.actualCarbsG ?? Math.round(recentDuplicate.carbsG),
            actualFatG: existingDailyLog?.actualFatG ?? Math.round(recentDuplicate.fatG),
            targetKcal: existingDailyLog?.targetKcal ?? null,
            adherenceScore: existingDailyLog?.adherenceScore ?? 0,
          },
        };
      }

      // Create TrackedMeal with source='manual'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          loggedDate: dateOnly,
          mealSlot: mealSlot || null,
          mealName: foodName.trim(),
          portion: 1.0,
          kcal,
          proteinG,
          carbsG,
          fatG,
          fiberG: null,
          source: 'manual',
          confidenceScore: 1.0, // manual entries are exact
        },
      });

      // Update or create DailyLog
      // Try to get target values from active meal plan
      const activePlan = await tx.mealPlan.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { generatedAt: 'desc' },
      });

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
            targetKcal: activePlan?.dailyKcalTarget || 2000,
            targetProteinG: activePlan?.dailyProteinG || 150,
            targetCarbsG: activePlan?.dailyCarbsG || 200,
            targetFatG: activePlan?.dailyFatG || 67,
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
      const targetKcal = dailyLog.targetKcal || 2000;
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
          adherenceScore,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Manual log meal error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
