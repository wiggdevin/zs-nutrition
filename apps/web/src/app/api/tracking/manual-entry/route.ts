import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { calculateAdherenceScore } from '@/lib/adherence';
import { logger } from '@/lib/safe-logger';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';
import { checkRateLimit, generalLimiter, rateLimitExceededResponse } from '@/lib/rate-limit';
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '@/lib/api-response';

/**
 * POST /api/tracking/manual-entry
 * Manually log a food with custom nutrition data.
 * Creates a TrackedMeal with source='manual' and updates the DailyLog.
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

    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(generalLimiter, ip);
    if (!rl.success) {
      return rateLimitExceededResponse(rl.reset);
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
    const { foodName, calories, protein, carbs, fat, mealSlot, loggedDate } = body;

    // Validate required fields
    if (!foodName || typeof foodName !== 'string' || foodName.trim().length === 0) {
      return badRequest('Food name is required');
    }
    if (typeof foodName === 'string' && foodName.trim().length > 200) {
      return badRequest('Food name must be 200 characters or less');
    }
    if (
      calories === undefined ||
      calories === null ||
      isNaN(Number(calories)) ||
      Number(calories) < 0 ||
      Number(calories) > 10000
    ) {
      return badRequest('Valid calories value is required (0-10000)');
    }
    if (
      protein !== undefined &&
      protein !== null &&
      (isNaN(Number(protein)) || Number(protein) < 0 || Number(protein) > 1000)
    ) {
      return badRequest('Protein must be between 0 and 1000');
    }
    if (
      carbs !== undefined &&
      carbs !== null &&
      (isNaN(Number(carbs)) || Number(carbs) < 0 || Number(carbs) > 1000)
    ) {
      return badRequest('Carbs must be between 0 and 1000');
    }
    if (
      fat !== undefined &&
      fat !== null &&
      (isNaN(Number(fat)) || Number(fat) < 0 || Number(fat) > 1000)
    ) {
      return badRequest('Fat must be between 0 and 1000');
    }
    if (mealSlot !== undefined && typeof mealSlot === 'string' && mealSlot.length > 200) {
      return badRequest('Meal slot must be 200 characters or less');
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

    return apiSuccess({ ...result });
  } catch (error) {
    logger.error('Manual entry error:', error);
    return serverError();
  }
}
