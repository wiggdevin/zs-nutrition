import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';

/**
 * Tracking Router — handles daily summary, tracked meals queries, and macro tracking.
 *
 * All dates are handled as local calendar days (midnight to midnight in user's timezone).
 * This ensures meals logged at 11:30 PM are assigned to the correct day.
 */
export const trackingRouter = router({
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

      return {
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
    }),

  /**
   * getWeeklyTrend: Returns 7 days of daily summaries for trend visualization.
   * Each day includes targets, actuals, and adherence score.
   */
  getWeeklyTrend: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date string — first day of the 7-day window
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      // Validate date is not in the future
      const todayOnly = toLocalDay();
      const startOnly = parseLocalDay(input.startDate);

      // Disallow future dates
      if (startOnly > todayOnly) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Start date cannot be in the future',
        });
      }

      // Calculate end date (exclusive, for database queries)
      const endOnly = new Date(startOnly);
      endOnly.setUTCDate(endOnly.getUTCDate() + 7);

      // Fetch all DailyLogs in the 7-day range
      const dailyLogs = await prisma.dailyLog.findMany({
        where: {
          userId: dbUserId,
          date: {
            gte: startOnly,
            lt: endOnly,
          },
        },
        orderBy: { date: 'asc' },
      });

      // Also fetch TrackedMeals for this range to compute totals for days without DailyLog
      // Limit to 100 meals per week (very generous - prevents unbounded queries)
      const trackedMeals = await prisma.trackedMeal.findMany({
        where: {
          userId: dbUserId,
          loggedDate: {
            gte: startOnly,
            lt: endOnly,
          },
        },
        orderBy: { loggedDate: 'asc' },
        take: 100, // Max 100 meals per week is very generous
      });

      // Group tracked meals by date string
      // Since we store dates as UTC midnight representing local days, we can use toISOString() directly
      const mealsByDate: Record<string, typeof trackedMeals> = {};
      for (const meal of trackedMeals) {
        const dateKey = meal.loggedDate.toISOString();
        if (!mealsByDate[dateKey]) mealsByDate[dateKey] = [];
        mealsByDate[dateKey].push(meal);
      }

      // Index DailyLogs by date string
      const logsByDate: Record<string, (typeof dailyLogs)[0]> = {};
      for (const log of dailyLogs) {
        const dateKey = log.date.toISOString();
        logsByDate[dateKey] = log;
      }

      // Build 7-day summary array
      const days: Array<{
        date: string;
        targets: {
          kcal: number | null;
          proteinG: number | null;
          carbsG: number | null;
          fatG: number | null;
        } | null;
        actuals: {
          kcal: number;
          proteinG: number;
          carbsG: number;
          fatG: number;
        };
        adherenceScore: number | null;
        mealCount: number;
      }> = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOnly);
        dayDate.setUTCDate(dayDate.getUTCDate() + i);
        const dateKey = dayDate.toISOString();

        const log = logsByDate[dateKey] ?? null;
        const dayMeals = mealsByDate[dateKey] ?? [];

        // Compute actuals from tracked meals
        const computed = dayMeals.reduce(
          (acc, m) => ({
            kcal: acc.kcal + m.kcal,
            proteinG: acc.proteinG + m.proteinG,
            carbsG: acc.carbsG + m.carbsG,
            fatG: acc.fatG + m.fatG,
          }),
          { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        );

        days.push({
          date: dateKey,
          targets: log
            ? {
                kcal: log.targetKcal,
                proteinG: log.targetProteinG,
                carbsG: log.targetCarbsG,
                fatG: log.targetFatG,
              }
            : null,
          actuals: {
            kcal: log ? log.actualKcal : Math.round(computed.kcal),
            proteinG: log ? log.actualProteinG : Math.round(computed.proteinG * 10) / 10,
            carbsG: log ? log.actualCarbsG : Math.round(computed.carbsG * 10) / 10,
            fatG: log ? log.actualFatG : Math.round(computed.fatG * 10) / 10,
          },
          adherenceScore: log?.adherenceScore ?? null,
          mealCount: dayMeals.length,
        });
      }

      return {
        startDate: startOnly.toISOString(),
        endDate: endOnly.toISOString(),
        days,
        totalDays: 7,
      };
    }),

  /**
   * getMonthlyTrend: Returns all daily summaries for a given month for adherence heatmap.
   */
  getMonthlyTrend: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2024).max(2030),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const startDate = new Date(Date.UTC(input.year, input.month - 1, 1));
      const endDate = new Date(Date.UTC(input.year, input.month, 1));

      const dailyLogs = await prisma.dailyLog.findMany({
        where: {
          userId: dbUserId,
          date: { gte: startDate, lt: endDate },
        },
        orderBy: { date: 'asc' },
      });

      const daysTracked = dailyLogs.length;
      const dailyScores = dailyLogs.map((log) => ({
        date: log.date.toISOString(),
        adherenceScore: log.adherenceScore ?? 0,
        kcal: log.actualKcal,
        proteinG: log.actualProteinG,
        carbsG: log.actualCarbsG,
        fatG: log.actualFatG,
      }));

      const avgAdherence =
        daysTracked > 0
          ? Math.round(dailyScores.reduce((sum, d) => sum + d.adherenceScore, 0) / daysTracked)
          : 0;
      const avgKcal =
        daysTracked > 0
          ? Math.round(dailyScores.reduce((sum, d) => sum + d.kcal, 0) / daysTracked)
          : 0;
      const avgProteinG =
        daysTracked > 0
          ? Math.round(dailyScores.reduce((sum, d) => sum + d.proteinG, 0) / daysTracked)
          : 0;
      const avgCarbsG =
        daysTracked > 0
          ? Math.round(dailyScores.reduce((sum, d) => sum + d.carbsG, 0) / daysTracked)
          : 0;
      const avgFatG =
        daysTracked > 0
          ? Math.round(dailyScores.reduce((sum, d) => sum + d.fatG, 0) / daysTracked)
          : 0;

      let bestStreak = 0;
      let currentStreak = 0;
      for (const score of dailyScores) {
        if (score.adherenceScore >= 70) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      return {
        month: input.month,
        year: input.year,
        avgAdherence,
        daysTracked,
        dailyScores,
        avgKcal,
        avgProteinG,
        avgCarbsG,
        avgFatG,
        bestStreak,
      };
    }),

  /**
   * getWaterLog: Returns water intake entries for a given date.
   */
  getWaterLog: protectedProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;
      const dateOnly = input?.date ? parseLocalDay(input.date) : toLocalDay();

      const entries = await prisma.waterLog.findMany({
        where: { userId: dbUserId, date: dateOnly },
        orderBy: { createdAt: 'asc' },
      });

      const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);

      return {
        date: dateOnly.toISOString(),
        totalMl,
        entries: entries.map((e) => ({
          id: e.id,
          amountMl: e.amountMl,
          source: e.source,
          createdAt: e.createdAt,
        })),
      };
    }),

  /**
   * logWater: Add a water intake entry for a given date.
   */
  logWater: protectedProcedure
    .input(
      z.object({
        amountMl: z.number().int().min(1).max(5000),
        date: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;
      const dateOnly = input.date ? parseLocalDay(input.date) : toLocalDay();

      const entry = await prisma.waterLog.create({
        data: {
          userId: dbUserId,
          date: dateOnly,
          amountMl: input.amountMl,
          source: 'manual',
        },
      });

      const allEntries = await prisma.waterLog.findMany({
        where: { userId: dbUserId, date: dateOnly },
      });
      const totalMl = allEntries.reduce((sum, e) => sum + e.amountMl, 0);

      return {
        entry: { id: entry.id, amountMl: entry.amountMl, createdAt: entry.createdAt },
        totalMl,
      };
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
        const activeProfile = await tx.userProfile.findFirst({
          where: { userId: dbUserId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });

        let dailyLog = await tx.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
        });

        if (!dailyLog) {
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

      return result;
    }),
});
