import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../../trpc';
import { calculateWeightTrend } from '../../utils/weight-trend';

/**
 * Weight Tracking sub-router — weight CRUD + trend queries.
 */
export const weightTrackingRouter = router({
  /**
   * logWeightEntry: Record a weekly weight entry for adaptive tracking
   */
  logWeightEntry: protectedProcedure
    .input(
      z.object({
        weightKg: z
          .number()
          .min(30, 'Weight must be at least 30 kg')
          .max(300, 'Weight must be 300 kg or less'),
        logDate: z.string().optional(),
        notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const targetDate = input.logDate ? new Date(input.logDate) : new Date();
      const dateOnly = new Date(
        Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      );

      const weightLbs = Math.round(input.weightKg * 2.20462 * 10) / 10;

      const existing = await prisma.weightEntry.findUnique({
        where: {
          userId_logDate: {
            userId: dbUserId,
            logDate: dateOnly,
          },
        },
      });

      const weightEntry = await prisma.weightEntry.upsert({
        where: {
          userId_logDate: {
            userId: dbUserId,
            logDate: dateOnly,
          },
        },
        update: {
          weightKg: input.weightKg,
          weightLbs,
          notes: input.notes || null,
        },
        create: {
          userId: dbUserId,
          weightKg: input.weightKg,
          weightLbs,
          logDate: dateOnly,
          notes: input.notes || null,
        },
      });

      return { weightEntry, isUpdate: !!existing };
    }),

  /**
   * getWeightHistory: Get all weight entries for trend analysis
   */
  getWeightHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(52).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const limit = input?.limit || 12;

      const weightEntries = await prisma.weightEntry.findMany({
        where: { userId: dbUserId },
        orderBy: { logDate: 'desc' },
        take: limit,
      });

      return {
        entries: weightEntries.map((e) => ({
          id: e.id,
          weightKg: e.weightKg,
          weightLbs: e.weightLbs,
          logDate: e.logDate.toISOString(),
          notes: e.notes,
          createdAt: e.createdAt.toISOString(),
        })),
        totalEntries: weightEntries.length,
      };
    }),

  /**
   * analyzeWeightTrend: Calculate rate of change and detect progress patterns
   */
  analyzeWeightTrend: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found. Please complete onboarding first.',
      });
    }

    const weightEntriesDesc = await prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'desc' },
      take: 90,
    });
    const weightEntries = weightEntriesDesc.reverse();

    if (weightEntries.length < 2) {
      return {
        hasEnoughData: false,
        message: 'Need at least 2 weight entries to analyze trends',
        entries: weightEntries.length,
      };
    }

    const trend = calculateWeightTrend(weightEntries)!;

    // Calculate recent trend (last 4 entries)
    const recentEntries = weightEntries.slice(-4);
    const recentTrend = calculateWeightTrend(recentEntries);

    // Detect milestones (every 5 lbs from starting weight)
    const firstEntry = weightEntries[0];
    const lastEntry = weightEntries[weightEntries.length - 1];
    const startWeightLbs = firstEntry.weightLbs;
    const currentWeightLbs = lastEntry.weightLbs;
    const milestones: string[] = [];

    const milestoneIncr = 5;
    const startMilestone = Math.floor(startWeightLbs / milestoneIncr) * milestoneIncr;
    const currentMilestone = Math.floor(currentWeightLbs / milestoneIncr) * milestoneIncr;

    if (profile.goalType === 'cut' && currentWeightLbs < startWeightLbs) {
      for (let m = startMilestone; m >= currentMilestone; m -= milestoneIncr) {
        if (m < startWeightLbs && m <= currentWeightLbs + milestoneIncr) {
          milestones.push(`${milestoneIncr}lbs lost to ${m}lbs`);
        }
      }
    } else if (profile.goalType === 'bulk' && currentWeightLbs > startWeightLbs) {
      for (let m = startMilestone; m <= currentMilestone; m += milestoneIncr) {
        if (m > startWeightLbs && m >= currentWeightLbs - milestoneIncr) {
          milestones.push(`${milestoneIncr}lbs gained to ${m}lbs`);
        }
      }
    }

    const goalRateLbsPerWeek = profile.goalRate;
    const isOnTrack =
      Math.abs(
        trend.weeklyRateLbs -
          (profile.goalType === 'cut'
            ? -goalRateLbsPerWeek
            : profile.goalType === 'bulk'
              ? goalRateLbsPerWeek
              : 0)
      ) < 0.5;

    return {
      hasEnoughData: true,
      profile: {
        goalType: profile.goalType,
        goalRate: profile.goalRate,
        goalKcal: profile.goalKcal,
        bmrKcal: profile.bmrKcal,
      },
      overallTrend: {
        startWeightKg: firstEntry.weightKg,
        startWeightLbs: firstEntry.weightLbs,
        currentWeightKg: lastEntry.weightKg,
        currentWeightLbs: lastEntry.weightLbs,
        weightChangeKg: trend.weightChangeKg,
        weightChangeLbs: trend.weightChangeLbs,
        timeSpanDays: trend.timeSpanDays,
        weeklyRateKg: trend.weeklyRateKg,
        weeklyRateLbs: trend.weeklyRateLbs,
      },
      recentTrend: {
        weeklyRateKg: recentTrend?.weeklyRateKg ?? 0,
        weeklyRateLbs: recentTrend?.weeklyRateLbs ?? 0,
      },
      isOnTrack,
      milestones,
      totalEntries: weightEntries.length,
    };
  }),
});
