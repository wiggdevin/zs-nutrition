import { z } from 'zod';
import { protectedProcedure } from '../../trpc';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';
import { cacheGet, cacheSet, cacheDelete, CacheKeys } from '@/lib/cache';
import { DailySummaryResult } from './types';

export const dailyProcedures = {
  /**
   * getDailySummary: Returns a DailyLog with targets and actuals, plus all TrackedMeal entries for a given date.
   */
  getDailySummary: protectedProcedure
    .input(
      z
        .object({
          date: z.string().optional(), // ISO date string, defaults to today
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      // Parse date input or default to today
      // Use local day utilities to ensure consistent date boundaries
      const dateOnly = input?.date ? parseLocalDay(input.date) : toLocalDay();

      // Check cache first (TTL: 60s)
      const dateStr = dateOnly.toISOString().slice(0, 10);
      const dailyCacheKey = CacheKeys.dailySummary(dbUserId, dateStr);
      const cached = await cacheGet<DailySummaryResult>(dailyCacheKey);
      if (cached) return cached;

      // Fetch DailyLog and all TrackedMeals for this date in parallel
      // Use select to only fetch needed fields for optimal performance
      const [dailyLog, trackedMeals] = await Promise.all([
        prisma.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
          select: {
            id: true,
            targetKcal: true,
            targetProteinG: true,
            targetCarbsG: true,
            targetFatG: true,
            actualKcal: true,
            actualProteinG: true,
            actualCarbsG: true,
            actualFatG: true,
            adherenceScore: true,
          },
        }),
        prisma.trackedMeal.findMany({
          where: {
            userId: dbUserId,
            loggedDate: dateOnly,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            mealPlanId: true,
            mealSlot: true,
            mealName: true,
            portion: true,
            kcal: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            fiberG: true,
            source: true,
            confidenceScore: true,
            createdAt: true,
          },
        }),
      ]);

      // Calculate totals from tracked meals for verification
      const calculatedTotals = trackedMeals.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + meal.kcal,
          proteinG: acc.proteinG + meal.proteinG,
          carbsG: acc.carbsG + meal.carbsG,
          fatG: acc.fatG + meal.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      );

      const result = {
        date: dateOnly.toISOString(),
        dailyLog: dailyLog
          ? {
              id: dailyLog.id,
              targetKcal: dailyLog.targetKcal,
              targetProteinG: dailyLog.targetProteinG,
              targetCarbsG: dailyLog.targetCarbsG,
              targetFatG: dailyLog.targetFatG,
              actualKcal: dailyLog.actualKcal,
              actualProteinG: dailyLog.actualProteinG,
              actualCarbsG: dailyLog.actualCarbsG,
              actualFatG: dailyLog.actualFatG,
              adherenceScore: dailyLog.adherenceScore,
            }
          : null,
        trackedMeals: trackedMeals.map((m) => ({
          id: m.id,
          mealPlanId: m.mealPlanId,
          mealSlot: m.mealSlot,
          mealName: m.mealName,
          portion: m.portion,
          kcal: m.kcal,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          fiberG: m.fiberG,
          source: m.source,
          confidenceScore: m.confidenceScore,
          createdAt: m.createdAt,
        })),
        totals: {
          kcal: Math.round(calculatedTotals.kcal),
          proteinG: Math.round(calculatedTotals.proteinG * 10) / 10,
          carbsG: Math.round(calculatedTotals.carbsG * 10) / 10,
          fatG: Math.round(calculatedTotals.fatG * 10) / 10,
        },
        mealCount: trackedMeals.length,
      };

      // Cache for 60 seconds
      await cacheSet(dailyCacheKey, result, 60);
      return result;
    }),

  /**
   * logMeal: Log a meal with macro tracking. Validates all nutritional values are non-negative.
   */
  logMeal: protectedProcedure
    .input(
      z.object({
        mealName: z
          .string()
          .min(1, 'Meal name is required')
          .max(200, 'Meal name must be 200 characters or less'),
        calories: z
          .number()
          .min(0, 'Calories cannot be negative')
          .max(10000, 'Calories must be 10000 or less'),
        protein: z
          .number()
          .min(0, 'Protein cannot be negative')
          .max(1000, 'Protein must be 1000g or less'),
        carbs: z
          .number()
          .min(0, 'Carbs cannot be negative')
          .max(1000, 'Carbs must be 1000g or less'),
        fat: z.number().min(0, 'Fat cannot be negative').max(1000, 'Fat must be 1000g or less'),
        mealSlot: z
          .enum(['breakfast', 'lunch', 'dinner', 'snack'], {
            errorMap: () => ({ message: 'Meal slot must be breakfast, lunch, dinner, or snack' }),
          })
          .optional(),
        date: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      // Parse date input or default to today
      // Use local day utilities to ensure consistent date boundaries
      const dateOnly = input.date ? parseLocalDay(input.date) : toLocalDay();

      // Use a serialized transaction to prevent race conditions from concurrent requests
      const result = await prisma.$transaction(async (tx) => {
        // Create TrackedMeal
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: dbUserId,
            loggedDate: dateOnly,
            mealSlot: input.mealSlot || null,
            mealName: input.mealName,
            portion: 1.0,
            kcal: Math.round(input.calories),
            proteinG: Math.round(input.protein * 10) / 10,
            carbsG: Math.round(input.carbs * 10) / 10,
            fatG: Math.round(input.fat * 10) / 10,
            fiberG: null,
            source: 'manual',
            confidenceScore: 1.0,
          },
        });

        // Find or create DailyLog
        let dailyLog = await tx.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
        });

        if (!dailyLog) {
          const activeProfile = await tx.userProfile.findFirst({
            where: { userId: dbUserId, isActive: true },
            orderBy: { createdAt: 'desc' },
          });

          dailyLog = await tx.dailyLog.create({
            data: {
              userId: dbUserId,
              date: dateOnly,
              targetKcal: activeProfile?.goalKcal || null,
              targetProteinG: activeProfile?.proteinTargetG || null,
              targetCarbsG: activeProfile?.carbsTargetG || null,
              targetFatG: activeProfile?.fatTargetG || null,
              actualKcal: Math.round(input.calories),
              actualProteinG: Math.round(input.protein),
              actualCarbsG: Math.round(input.carbs),
              actualFatG: Math.round(input.fat),
            },
          });
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + Math.round(input.calories),
              actualProteinG: dailyLog.actualProteinG + Math.round(input.protein),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(input.carbs),
              actualFatG: dailyLog.actualFatG + Math.round(input.fat),
            },
          });
        }

        return {
          trackedMeal: {
            id: trackedMeal.id,
            mealName: trackedMeal.mealName,
            mealSlot: trackedMeal.mealSlot,
            kcal: trackedMeal.kcal,
            proteinG: trackedMeal.proteinG,
            carbsG: trackedMeal.carbsG,
            fatG: trackedMeal.fatG,
            source: trackedMeal.source,
            createdAt: trackedMeal.createdAt,
          },
          dailyLog: {
            actualKcal: dailyLog.actualKcal,
            actualProteinG: dailyLog.actualProteinG,
            actualCarbsG: dailyLog.actualCarbsG,
            actualFatG: dailyLog.actualFatG,
          },
        };
      });

      // Invalidate daily summary cache
      const logDateStr = dateOnly.toISOString().slice(0, 10);
      await cacheDelete(CacheKeys.dailySummary(dbUserId, logDateStr));

      return result;
    }),
};
