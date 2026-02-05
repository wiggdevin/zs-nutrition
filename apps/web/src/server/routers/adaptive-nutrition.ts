import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc';

/**
 * Adaptive Nutrition Router — handles weight tracking, trend analysis,
 * and adaptive calorie adjustments based on progress toward goals.
 */
export const adaptiveNutritionRouter = router({
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
        logDate: z.string().optional(), // ISO date string, defaults to today
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

      // Convert kg to lbs for display
      const weightLbs = Math.round(input.weightKg * 2.20462 * 10) / 10;

      // Use upsert pattern with the compound unique constraint on (userId, logDate)
      // After running prisma generate, this will use the unique key for atomic upsert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const weightEntry = await (prisma.weightEntry.upsert as any)({
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

      return { weightEntry };
    }),

  /**
   * getWeightHistory: Get all weight entries for trend analysis
   */
  getWeightHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(52).optional(), // Max 52 weeks (1 year)
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const limit = input?.limit || 12; // Default to 12 weeks

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

    // Get user's active profile for goal context
    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found. Please complete onboarding first.',
      });
    }

    // Get all weight entries, sorted by date
    const weightEntries = await prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'asc' },
    });

    if (weightEntries.length < 2) {
      return {
        hasEnoughData: false,
        message: 'Need at least 2 weight entries to analyze trends',
        entries: weightEntries.length,
      };
    }

    // Calculate overall trend
    const firstEntry = weightEntries[0];
    const lastEntry = weightEntries[weightEntries.length - 1];
    const timeSpanDays = Math.max(
      1,
      Math.round(
        (lastEntry.logDate.getTime() - firstEntry.logDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const weightChangeKg = lastEntry.weightKg - firstEntry.weightKg;
    const weightChangeLbs = lastEntry.weightLbs - firstEntry.weightLbs;
    const weeklyRateKg = (weightChangeKg / timeSpanDays) * 7;
    const weeklyRateLbs = (weightChangeLbs / timeSpanDays) * 7;

    // Calculate recent trend (last 4 entries)
    const recentEntries = weightEntries.slice(-4);
    let recentWeeklyRateKg = 0;
    let recentWeeklyRateLbs = 0;

    if (recentEntries.length >= 2) {
      const recentFirst = recentEntries[0];
      const recentLast = recentEntries[recentEntries.length - 1];
      const recentTimeSpanDays = Math.max(
        1,
        Math.round(
          (recentLast.logDate.getTime() - recentFirst.logDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const recentChangeKg = recentLast.weightKg - recentFirst.weightKg;
      const recentChangeLbs = recentLast.weightLbs - recentFirst.weightLbs;
      recentWeeklyRateKg = (recentChangeKg / recentTimeSpanDays) * 7;
      recentWeeklyRateLbs = (recentChangeLbs / recentTimeSpanDays) * 7;
    }

    // Detect milestones (every 5 lbs from starting weight)
    const startWeightLbs = firstEntry.weightLbs;
    const currentWeightLbs = lastEntry.weightLbs;
    const milestones: string[] = [];

    const milestoneIncr = 5;
    const startMilestone = Math.floor(startWeightLbs / milestoneIncr) * milestoneIncr;
    const currentMilestone = Math.floor(currentWeightLbs / milestoneIncr) * milestoneIncr;

    if (profile.goalType === 'cut' && currentWeightLbs < startWeightLbs) {
      // Weight loss milestones
      for (let m = startMilestone; m >= currentMilestone; m -= milestoneIncr) {
        if (m < startWeightLbs && m <= currentWeightLbs + milestoneIncr) {
          milestones.push(`${milestoneIncr}lbs lost to ${m}lbs`);
        }
      }
    } else if (profile.goalType === 'bulk' && currentWeightLbs > startWeightLbs) {
      // Weight gain milestones
      for (let m = startMilestone; m <= currentMilestone; m += milestoneIncr) {
        if (m > startWeightLbs && m >= currentWeightLbs - milestoneIncr) {
          milestones.push(`${milestoneIncr}lbs gained to ${m}lbs`);
        }
      }
    }

    // Compare to goal rate
    const goalRateLbsPerWeek = profile.goalRate;
    const isOnTrack =
      Math.abs(
        weeklyRateLbs -
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
        weightChangeKg: Math.round(weightChangeKg * 10) / 10,
        weightChangeLbs: Math.round(weightChangeLbs * 10) / 10,
        timeSpanDays,
        weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
        weeklyRateLbs: Math.round(weeklyRateLbs * 100) / 100,
      },
      recentTrend: {
        weeklyRateKg: Math.round(recentWeeklyRateKg * 100) / 100,
        weeklyRateLbs: Math.round(recentWeeklyRateLbs * 100) / 100,
      },
      isOnTrack,
      milestones,
      totalEntries: weightEntries.length,
    };
  }),

  /**
   * suggestCalorieAdjustment: Analyze progress and suggest adaptive calorie changes
   */
  suggestCalorieAdjustment: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    // Get user's active profile
    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found.',
      });
    }

    // Analyze weight trend
    const trend = await ctx.prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'asc' },
    });

    if (trend.length < 2) {
      return {
        hasSuggestion: false,
        reason: 'Need at least 2 weight entries to suggest adjustments',
        currentGoalKcal: profile.goalKcal,
      };
    }

    const firstEntry = trend[0];
    const lastEntry = trend[trend.length - 1];
    const timeSpanDays = Math.max(
      1,
      Math.round(
        (lastEntry.logDate.getTime() - firstEntry.logDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const weightChangeLbs = lastEntry.weightLbs - firstEntry.weightLbs;
    const weeklyRateLbs = (weightChangeLbs / timeSpanDays) * 7;

    // Determine if adjustment is needed
    const goalRateLbs = profile.goalRate;
    const currentGoalKcal = profile.goalKcal ?? 0;
    let suggestedKcal: number = currentGoalKcal;
    let adjustmentReason = 'No adjustment needed - on track';
    let shouldAdjust = false;

    // Safe bounds: BMR + 200 to BMR + 1500
    const minSafeKcal = (profile.bmrKcal ?? 0) + 200;
    const maxSafeKcal = (profile.bmrKcal ?? 0) + 1500;

    if (profile.goalType === 'cut') {
      const expectedRate = -goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      // Losing too slowly or gaining (need to cut more)
      if (deviation > 0.5) {
        const decrease = Math.round(deviation * 100); // ~100 kcal per 0.5 lb/week deviation
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        shouldAdjust = true;
        adjustmentReason = `Weight loss slower than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Decreasing calories to maintain progress.`;
      }
      // Losing too fast (risk of muscle loss or metabolic adaptation)
      else if (deviation < -1) {
        const increase = Math.round(Math.abs(deviation) * 100);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        shouldAdjust = true;
        adjustmentReason = `Weight loss faster than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Increasing calories to prevent metabolic adaptation and preserve muscle.`;
      }
    } else if (profile.goalType === 'bulk') {
      const expectedRate = goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      // Gaining too slowly or losing
      if (deviation < -0.5) {
        const increase = Math.round(Math.abs(deviation) * 150); // Bulks need more kcal surplus
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        shouldAdjust = true;
        adjustmentReason = `Weight gain slower than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Increasing calories to support growth.`;
      }
      // Gaining too fast (likely fat, not muscle)
      else if (deviation > 1) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        shouldAdjust = true;
        adjustmentReason = `Weight gain faster than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Decreasing calories to minimize fat gain.`;
      }
    }

    // Round to nearest 50 calories for cleaner targets
    suggestedKcal = Math.round(suggestedKcal / 50) * 50;

    return {
      hasSuggestion: shouldAdjust,
      currentGoalKcal,
      suggestedGoalKcal: suggestedKcal,
      calorieDifference: suggestedKcal - currentGoalKcal,
      adjustmentReason,
      safeBounds: {
        min: minSafeKcal,
        max: maxSafeKcal,
      },
      trendData: {
        weeklyRateLbs: Math.round(weeklyRateLbs * 100) / 100,
        weightChangeLbs: Math.round(weightChangeLbs * 10) / 10,
        timeSpanDays,
      },
    };
  }),

  /**
   * applyCalorieAdjustment: Apply adaptive calorie adjustment with audit log
   */
  applyCalorieAdjustment: protectedProcedure
    .input(
      z.object({
        newGoalKcal: z
          .number()
          .min(1200, 'Calories must be at least 1200')
          .max(5000, 'Calories must be 5000 or less'),
        confirmed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      if (!input.confirmed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must confirm the calorie adjustment.',
        });
      }

      // Get user's active profile
      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active profile found.',
        });
      }

      // Verify bmrKcal is available for safe bounds calculation
      if (!profile.bmrKcal) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Metabolic profile is incomplete. Please regenerate your meal plan.',
        });
      }

      // Verify safe bounds
      const minSafeKcal = profile.bmrKcal + 200;
      const maxSafeKcal = profile.bmrKcal + 1500;

      if (input.newGoalKcal < minSafeKcal || input.newGoalKcal > maxSafeKcal) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Calories must be between ${minSafeKcal} and ${maxSafeKcal} for safe metabolic function.`,
        });
      }

      // Get trend data for audit log
      const trend = await prisma.weightEntry.findMany({
        where: { userId: dbUserId },
        orderBy: { logDate: 'asc' },
      });

      let weightChangeKg: number | null = null;
      let weightChangeLbs: number | null = null;
      let trendAnalysis: Record<string, unknown> | null = null;

      if (trend.length >= 2) {
        const firstEntry = trend[0];
        const lastEntry = trend[trend.length - 1];
        const timeSpanDays = Math.round(
          (lastEntry.logDate.getTime() - firstEntry.logDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        weightChangeKg = Math.round((lastEntry.weightKg - firstEntry.weightKg) * 10) / 10;
        weightChangeLbs = Math.round((lastEntry.weightLbs - firstEntry.weightLbs) * 10) / 10;

        trendAnalysis = {
          timeSpanDays,
          weeklyRateLbs: Math.round((weightChangeLbs / timeSpanDays) * 7 * 100) / 100,
          entries: trend.length,
        };
      }

      // Check for milestone (every 5 lbs milestone from 5 to 25)
      let milestoneAchieved: string | null = null;
      if (trend.length >= 2 && weightChangeLbs !== null && Math.abs(weightChangeLbs) >= 5) {
        const milestone = Math.floor(Math.abs(weightChangeLbs) / 5) * 5;
        if (milestone >= 5 && milestone <= 25) {
          milestoneAchieved = `${milestone} lbs ${weightChangeLbs > 0 ? 'gained' : 'lost'}!`;
        }
      }

      // Create calorie adjustment audit log
      const adjustment = await prisma.calorieAdjustment.create({
        data: {
          userId: dbUserId,
          previousGoalKcal: profile.goalKcal ?? 0,
          newGoalKcal: input.newGoalKcal,
          adjustmentReason: JSON.stringify({
            reason: `Adaptive adjustment based on ${trend.length} weight entries`,
            profileGoalType: profile.goalType,
            profileGoalRate: profile.goalRate,
          }),
          weightChangeKg,
          weightChangeLbs,
          trendAnalysis: trendAnalysis ? JSON.stringify(trendAnalysis) : null,
          milestoneAchieved,
          planRegenerated: false,
        },
      });

      // Update profile with new calorie targets
      const newGoalKcal = input.newGoalKcal;

      // Recalculate macros based on new calories
      const macroSplits: Record<string, { p: number; c: number; f: number }> = {
        balanced: { p: 0.3, c: 0.4, f: 0.3 },
        high_protein: { p: 0.4, c: 0.35, f: 0.25 },
        low_carb: { p: 0.35, c: 0.25, f: 0.4 },
        keto: { p: 0.3, c: 0.05, f: 0.65 },
      };
      const split = macroSplits[profile.macroStyle];
      if (!split) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Unknown macro style: ${profile.macroStyle}`,
        });
      }
      const proteinG = Math.round((newGoalKcal * split.p) / 4);
      const carbsG = Math.round((newGoalKcal * split.c) / 4);
      const fatG = Math.round((newGoalKcal * split.f) / 9);

      const updatedProfile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          goalKcal: newGoalKcal,
          proteinTargetG: proteinG,
          carbsTargetG: carbsG,
          fatTargetG: fatG,
        },
      });

      return {
        adjustment,
        updatedProfile: {
          id: updatedProfile.id,
          goalKcal: updatedProfile.goalKcal,
          proteinTargetG: updatedProfile.proteinTargetG,
          carbsTargetG: updatedProfile.carbsTargetG,
          fatTargetG: updatedProfile.fatTargetG,
        },
      };
    }),

  /**
   * getAdjustmentHistory: Get audit log of all calorie adjustments
   */
  getAdjustmentHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const limit = input?.limit || 10;

      const adjustments = await prisma.calorieAdjustment.findMany({
        where: { userId: dbUserId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        adjustments: adjustments.map((a) => ({
          id: a.id,
          previousGoalKcal: a.previousGoalKcal,
          newGoalKcal: a.newGoalKcal,
          calorieDifference: a.newGoalKcal - a.previousGoalKcal,
          adjustmentReason: a.adjustmentReason,
          weightChangeKg: a.weightChangeKg,
          weightChangeLbs: a.weightChangeLbs,
          trendAnalysis: a.trendAnalysis,
          milestoneAchieved: a.milestoneAchieved,
          planRegenerated: a.planRegenerated,
          createdAt: a.createdAt.toISOString(),
        })),
        total: adjustments.length,
      };
    }),
});
