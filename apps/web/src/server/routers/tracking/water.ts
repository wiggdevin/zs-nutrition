import { z } from 'zod';
import { protectedProcedure } from '../../trpc';
import { toLocalDay, parseLocalDay } from '@/lib/date-utils';
import { cacheDelete, CacheKeys } from '@/lib/cache';

export const waterProcedures = {
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

      const [entries, aggregateResult] = await Promise.all([
        prisma.waterLog.findMany({
          where: { userId: dbUserId, date: dateOnly },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.waterLog.aggregate({
          where: { userId: dbUserId, date: dateOnly },
          _sum: { amountMl: true },
        }),
      ]);

      const totalMl = aggregateResult._sum.amountMl ?? 0;

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

      const aggregation = await prisma.waterLog.aggregate({
        where: { userId: dbUserId, date: dateOnly },
        _sum: { amountMl: true },
      });
      const totalMl = aggregation._sum.amountMl ?? 0;

      // Invalidate daily summary cache
      const waterDateStr = dateOnly.toISOString().slice(0, 10);
      await cacheDelete(CacheKeys.dailySummary(dbUserId, waterDateStr));

      return {
        entry: { id: entry.id, amountMl: entry.amountMl, createdAt: entry.createdAt },
        totalMl,
      };
    }),
};
