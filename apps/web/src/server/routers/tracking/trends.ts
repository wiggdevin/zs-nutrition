import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../trpc';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';

export const trendsProcedures = {
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
};
