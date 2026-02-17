import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { recalculateDailyLog, calculateAdherenceScore } from '@/server/utils/daily-log';
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from '@/lib/api-response';

/**
 * PUT /api/tracking/adjust-portion
 * Adjust the portion of an already-logged meal.
 * Scales nutrition values proportionally and recalculates DailyLog totals.
 */
export async function PUT(request: NextRequest) {
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
    const { trackedMealId, newPortion } = body;

    if (!trackedMealId || typeof trackedMealId !== 'string') {
      return badRequest('trackedMealId is required');
    }

    if (typeof newPortion !== 'number' || newPortion <= 0 || newPortion > 10) {
      return badRequest('newPortion must be a number between 0.1 and 10');
    }

    // Get the tracked meal, ensuring it belongs to this user
    const trackedMeal = await prisma.trackedMeal.findFirst({
      where: { id: trackedMealId, userId: user.id },
    });

    if (!trackedMeal) {
      return notFound('Tracked meal not found');
    }

    // Calculate base nutrition values (per 1.0 portion)
    const oldPortion = trackedMeal.portion || 1.0;
    const baseKcal = trackedMeal.kcal / oldPortion;
    const baseProteinG = trackedMeal.proteinG / oldPortion;
    const baseCarbsG = trackedMeal.carbsG / oldPortion;
    const baseFatG = trackedMeal.fatG / oldPortion;
    const baseFiberG = trackedMeal.fiberG !== null ? trackedMeal.fiberG / oldPortion : null;

    // Apply new portion multiplier
    const newKcal = Math.round(baseKcal * newPortion);
    const newProteinG = Math.round(baseProteinG * newPortion * 10) / 10;
    const newCarbsG = Math.round(baseCarbsG * newPortion * 10) / 10;
    const newFatG = Math.round(baseFatG * newPortion * 10) / 10;
    const newFiberG = baseFiberG !== null ? Math.round(baseFiberG * newPortion * 10) / 10 : null;

    // Update the tracked meal
    const updatedMeal = await prisma.trackedMeal.update({
      where: { id: trackedMealId },
      data: {
        portion: newPortion,
        kcal: newKcal,
        proteinG: newProteinG,
        carbsG: newCarbsG,
        fatG: newFatG,
        fiberG: newFiberG,
      },
    });

    // Recalculate DailyLog totals from ALL tracked meals for this day
    const loggedDate = new Date(
      Date.UTC(
        trackedMeal.loggedDate.getUTCFullYear(),
        trackedMeal.loggedDate.getUTCMonth(),
        trackedMeal.loggedDate.getUTCDate()
      )
    );

    // Recalculate DailyLog totals using database aggregate
    const totals = await recalculateDailyLog(prisma, user.id, loggedDate);

    // Update DailyLog with recalculated totals
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId: user.id, date: loggedDate },
      },
    });

    if (dailyLog) {
      const adherenceScore = calculateAdherenceScore({
        actualKcal: totals.actualKcal,
        actualProteinG: totals.actualProteinG,
        actualCarbsG: totals.actualCarbsG,
        actualFatG: totals.actualFatG,
        targetKcal: dailyLog.targetKcal,
        targetProteinG: dailyLog.targetProteinG,
        targetCarbsG: dailyLog.targetCarbsG,
        targetFatG: dailyLog.targetFatG,
      });

      await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: {
          actualKcal: totals.actualKcal,
          actualProteinG: totals.actualProteinG,
          actualCarbsG: totals.actualCarbsG,
          actualFatG: totals.actualFatG,
          adherenceScore,
        },
      });
    }

    return apiSuccess({
      success: true,
      trackedMeal: {
        id: updatedMeal.id,
        mealName: updatedMeal.mealName,
        portion: updatedMeal.portion,
        kcal: updatedMeal.kcal,
        proteinG: updatedMeal.proteinG,
        carbsG: updatedMeal.carbsG,
        fatG: updatedMeal.fatG,
      },
      dailyTotals: {
        actualKcal: totals.actualKcal,
        actualProteinG: totals.actualProteinG,
        actualCarbsG: totals.actualCarbsG,
        actualFatG: totals.actualFatG,
      },
    });
  } catch (error) {
    logger.error('Adjust portion error:', error);
    return serverError();
  }
}
