import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { calculateAdherenceScore } from '@/lib/adherence';
import { logger } from '@/lib/safe-logger';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '@/lib/api-response';

/**
 * POST /api/tracking/fatsecret-log
 * Log a food from FatSecret search results.
 * Creates a TrackedMeal with source='fatsecret_search' and updates the DailyLog.
 */
export async function POST(request: Request) {
  try {
    let clerkUserId: string;
    let _dbUserId: string;
    try {
      ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      return message === 'Account is deactivated' ? forbidden(message) : unauthorized(message);
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return notFound('User not found');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }
    const {
      foodId,
      foodName,
      servingId: _servingId,
      servingDescription,
      quantity,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      mealSlot,
      loggedDate,
    } = body;

    // Validate required fields
    if (!foodId || typeof foodId !== 'string') {
      return badRequest('FatSecret food ID is required');
    }
    if (!foodName || typeof foodName !== 'string' || foodName.trim().length === 0) {
      return badRequest('Food name is required');
    }
    if (
      calories === undefined ||
      calories === null ||
      isNaN(Number(calories)) ||
      Number(calories) < 0
    ) {
      return badRequest('Valid calories value is required');
    }

    const qty = Math.max(0.1, Number(quantity) || 1);
    const kcal = Math.round(Number(calories) * qty);
    const proteinG = Math.round((Number(protein) || 0) * qty * 10) / 10;
    const carbsG = Math.round((Number(carbs) || 0) * qty * 10) / 10;
    const fatG = Math.round((Number(fat) || 0) * qty * 10) / 10;
    const fiberG =
      fiber !== undefined && fiber !== null
        ? Math.round((Number(fiber) || 0) * qty * 10) / 10
        : null;

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

    // Use a serialized transaction to prevent race conditions from concurrent requests
    const result = await prisma.$transaction(async (tx) => {
      // Duplicate detection: check if an identical meal was logged in the last 10 seconds
      const tenSecondsAgo = new Date(Date.now() - 10000);
      const recentDuplicate = await tx.trackedMeal.findFirst({
        where: {
          userId: user.id,
          loggedDate: dateOnly,
          mealName: foodName.trim(),
          kcal,
          source: 'fatsecret_search',
          fatsecretId: foodId,
          createdAt: { gte: tenSecondsAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentDuplicate) {
        // Return the existing entry instead of creating a duplicate
        const dailyLog = await tx.dailyLog.findUnique({
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
            fatsecretId: recentDuplicate.fatsecretId,
            servingDescription: servingDescription || null,
            quantity: qty,
          },
          dailyLog: dailyLog
            ? {
                actualKcal: dailyLog.actualKcal,
                actualProteinG: dailyLog.actualProteinG,
                actualCarbsG: dailyLog.actualCarbsG,
                actualFatG: dailyLog.actualFatG,
                adherenceScore: dailyLog.adherenceScore,
              }
            : null,
        };
      }

      // Create TrackedMeal with source='fatsecret_search'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          mealPlanId: null,
          loggedDate: dateOnly,
          mealSlot: mealSlot || null,
          mealName: foodName.trim(),
          portion: qty,
          kcal,
          proteinG,
          carbsG,
          fatG,
          fiberG,
          source: 'fatsecret_search',
          confidenceScore: 1.0, // FatSecret verified data
          fatsecretId: foodId,
        },
      });

      // Update or create DailyLog
      let dailyLog = await tx.dailyLog.findUnique({
        where: {
          userId_date: { userId: user.id, date: dateOnly },
        },
      });

      // Get targets from user's active profile
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

      // Calculate weighted adherence score
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
          fatsecretId: trackedMeal.fatsecretId,
          servingDescription: servingDescription || null,
          quantity: qty,
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

    return apiSuccess({ ...result });
  } catch (error) {
    logger.error('FatSecret log error:', error);
    return serverError();
  }
}
