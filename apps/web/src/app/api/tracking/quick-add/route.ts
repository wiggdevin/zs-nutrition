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
 * POST /api/tracking/quick-add
 * Quickly log calories and optional macros without searching for a food.
 * Creates a TrackedMeal with source='quick_add' and updates the DailyLog.
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
    if (rl && !rl.success) {
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
    const { calories, protein, carbs, fat, label, loggedDate } = body;

    // Validate required field: calories
    if (
      calories === undefined ||
      calories === null ||
      isNaN(Number(calories)) ||
      Number(calories) <= 0 ||
      Number(calories) > 10000
    ) {
      return badRequest('A valid calorie amount is required (must be > 0 and <= 10000)');
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
    if (label !== undefined && typeof label === 'string' && label.length > 200) {
      return badRequest('Label must be 200 characters or less');
    }

    const kcal = Math.round(Number(calories));
    const proteinG = Math.round((Number(protein) || 0) * 10) / 10;
    const carbsG = Math.round((Number(carbs) || 0) * 10) / 10;
    const fatG = Math.round((Number(fat) || 0) * 10) / 10;

    // Generate a default label if none provided
    const mealName =
      label && typeof label === 'string' && label.trim().length > 0
        ? label.trim()
        : `Quick Add (${kcal} kcal)`;

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
          mealName,
          kcal,
          source: 'quick_add',
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

      // Create TrackedMeal with source='quick_add'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          mealPlanId: null,
          loggedDate: dateOnly,
          mealSlot: null,
          mealName,
          portion: 1.0,
          kcal,
          proteinG,
          carbsG,
          fatG,
          fiberG: null,
          source: 'quick_add',
          confidenceScore: null,
        },
      });

      // Update or create DailyLog
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
    logger.error('Quick add error:', error);
    return serverError();
  }
}
