import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const fitnessRouter = router({
  getOuraInsights: protectedProcedure.query(async ({ ctx }) => {
    const connection = await ctx.prisma.fitnessConnection.findFirst({
      where: { userId: ctx.dbUserId, platform: 'oura', isActive: true },
      select: { id: true, lastSyncAt: true },
    });

    if (!connection) return null;

    const latestSync = await ctx.prisma.activitySync.findFirst({
      where: { userId: ctx.dbUserId, platform: 'oura' },
      orderBy: { syncDate: 'desc' },
    });

    if (!latestSync) return null;

    return {
      readinessScore: latestSync.readinessScore,
      readinessTemperature: latestSync.readinessTemperature,
      readinessHrvBalance: latestSync.readinessHrvBalance,
      sleepScore: latestSync.sleepScore,
      sleepMinutes: latestSync.sleepMinutes,
      sleepDeepMinutes: latestSync.sleepDeepMinutes,
      sleepRemMinutes: latestSync.sleepRemMinutes,
      sleepLightMinutes: latestSync.sleepLightMinutes,
      sleepAwakeMinutes: latestSync.sleepAwakeMinutes,
      sleepEfficiency: latestSync.sleepEfficiency,
      hrvAvg: latestSync.hrvAvg,
      heartRateResting: latestSync.heartRateResting,
      bodyTemperatureDelta: latestSync.bodyTemperatureDelta,
      steps: latestSync.steps,
      activeCalories: latestSync.activeCalories,
      syncDate: latestSync.syncDate,
      lastSyncAt: connection.lastSyncAt,
    };
  }),

  getHrvTrend: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const syncs = await ctx.prisma.activitySync.findMany({
        where: {
          userId: ctx.dbUserId,
          platform: 'oura',
          syncDate: { gte: since },
          hrvAvg: { not: null },
        },
        orderBy: { syncDate: 'asc' },
        select: {
          syncDate: true,
          hrvAvg: true,
          heartRateResting: true,
        },
      });

      return syncs.map((s) => ({
        date: s.syncDate,
        hrv: s.hrvAvg,
        restingHR: s.heartRateResting,
      }));
    }),

  getSleepStages: protectedProcedure.query(async ({ ctx }) => {
    const latestSync = await ctx.prisma.activitySync.findFirst({
      where: {
        userId: ctx.dbUserId,
        platform: 'oura',
        sleepDeepMinutes: { not: null },
      },
      orderBy: { syncDate: 'desc' },
      select: {
        syncDate: true,
        sleepMinutes: true,
        sleepDeepMinutes: true,
        sleepRemMinutes: true,
        sleepLightMinutes: true,
        sleepAwakeMinutes: true,
        sleepEfficiency: true,
        sleepScore: true,
      },
    });

    if (!latestSync) return null;

    return {
      date: latestSync.syncDate,
      totalMinutes: latestSync.sleepMinutes,
      deep: latestSync.sleepDeepMinutes,
      rem: latestSync.sleepRemMinutes,
      light: latestSync.sleepLightMinutes,
      awake: latestSync.sleepAwakeMinutes,
      efficiency: latestSync.sleepEfficiency,
      score: latestSync.sleepScore,
    };
  }),

  getReadinessHistory: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const syncs = await ctx.prisma.activitySync.findMany({
        where: {
          userId: ctx.dbUserId,
          platform: 'oura',
          syncDate: { gte: since },
          readinessScore: { not: null },
        },
        orderBy: { syncDate: 'asc' },
        select: {
          syncDate: true,
          readinessScore: true,
          readinessTemperature: true,
          readinessHrvBalance: true,
        },
      });

      return syncs.map((s) => ({
        date: s.syncDate,
        score: s.readinessScore,
        temperature: s.readinessTemperature,
        hrvBalance: s.readinessHrvBalance,
      }));
    }),
});
