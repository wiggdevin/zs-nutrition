import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { calculateAdherenceScore } from '@/lib/adherence';
import { logger } from '@/lib/safe-logger';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';

/**
 * POST /api/tracking/manual-entry
 * Manually log a food with custom nutrition data.
 * Creates a TrackedMeal with source='manual' and updates the DailyLog.
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
    const { foodName, calories, protein, carbs, fat, mealSlot, loggedDate } = body;

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

    // Use provided loggedDate or default to today
    // This ensures dates are stored consistently as UTC midnight representing the local calendar day
    let dateOnly: Date;
    if (loggedDate && typeof loggedDate === 'string') {
      // Parse the provided date (YYYY-MM-DD format from HTML date input)
      dateOnly = parseLocalDay(loggedDate);
    } else {
      // No date provided, use today in local time
      dateOnly = toLocalDay();
    }

    // Use a serialized transaction to prevent race conditions from concurrent tabs
    const result = await prisma.$transaction(async (tx) => {
      // Duplicate detection: check if an identical meal was logged in the last 10 seconds
      const tenSecondsAgo = new Date(Date.now() - 10000);
      const recentDuplicate = await tx.trackedMeal.findFirst({
        where: {
          userId: user.id,
          loggedDate: dateOnly,
          mealName: foodName.trim(),
          kcal,
          source: 'manual',
          createdAt: { gte: tenSecondsAgo },
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
            kcal: recentDuplicate.kcal,
            proteinG: recentDuplicate.proteinG,
            carbsG: recentDuplicate.carbsG,
            fatG: recentDuplicate.fatG,
            portion: recentDuplicate.portion || 1.0,
            source: recentDuplicate.source,
          },
          dailyLog: existingDailyLog
            ? {
                actualKcal: existingDailyLog.actualKcal,
                actualProteinG: existingDailyLog.actualProteinG,
                actualCarbsG: existingDailyLog.actualCarbsG,
                actualFatG: existingDailyLog.actualFatG,
                adherenceScore: existingDailyLog.adherenceScore,
              }
            : null,
        };
      }

      // Create TrackedMeal with source='manual'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          mealPlanId: null,
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
          confidenceScore: null,
        },
      });

      let dailyLog = await tx.dailyLog.findUnique({
        where: {
          userId_date: { userId: user.id, date: dateOnly },
        },
      });

      const profile = await tx.userProfile.findFirst({
        where: { userId: user.id, isActive: true },
        select: { goalKcal: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
      });

      if (!dailyLog) {
        dailyLog = await tx.dailyLog.create({
          data: {
            userId: user.id,
            date: dateOnly,
            targetKcal: profile?.goalKcal || 2000,
            targetProteinG: profile?.proteinTargetG || 150,
            targetCarbsG: profile?.carbsTargetG || 200,
            targetFatG: profile?.fatTargetG || 65,
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

      const adherenceScore = calculateAdherenceScore(dailyLog);
      await tx.dailyLog.update({
        where: { id: dailyLog.id },
        data: { adherenceScore },
      });

      return {
        success: true,
        trackedMeal: {
          id: trackedMeal.id,
          mealName: trackedMeal.mealName,
          kcal: trackedMeal.kcal,
          proteinG: trackedMeal.proteinG,
          carbsG: trackedMeal.carbsG,
          fatG: trackedMeal.fatG,
          portion: trackedMeal.portion,
          source: trackedMeal.source,
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

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Manual entry error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
