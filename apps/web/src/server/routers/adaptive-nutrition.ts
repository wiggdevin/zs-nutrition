import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { protectedProcedure, router } from '../trpc';
import { MACRO_SPLITS, calculateMacroTargets } from '@/lib/metabolic-utils';
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue';
import { logger } from '@/lib/safe-logger';

/**
 * Configuration constants for adaptive nutrition calculations.
 * Extracted for maintainability and testability.
 */
const ADAPTIVE_NUTRITION_CONFIG = {
  /** Minimum extra calories burned to trigger daily target adjustment */
  MIN_ACTIVITY_THRESHOLD_KCAL: 200,
  /** Rate at which activity calories are added back (50% = conservative replenishment) */
  ACTIVITY_REPLENISHMENT_RATE: 0.5,
  /** Weekly weight loss threshold below which plateau is detected (lbs/week) */
  PLATEAU_THRESHOLD_LBS_PER_WEEK: 0.3,
  /** Calorie targets are rounded to this factor for cleaner numbers */
  CALORIE_ROUNDING_FACTOR: 50,
  /** Safe calorie bounds relative to BMR */
  SAFE_BOUNDS: {
    MIN_ABOVE_BMR: 200,
    MAX_ABOVE_BMR: 1500,
  },
  /** Calorie adjustment multipliers per lb/week deviation */
  ADJUSTMENT_MULTIPLIERS: {
    CUT_DECREASE_PER_LB: 100,
    BULK_INCREASE_PER_LB: 150,
    BULK_DECREASE_PER_LB: 100,
  },
} as const;

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
      // The schema defines @@unique([userId, logDate]) which creates the userId_logDate compound key
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

    // Get recent weight entries for trend analysis (90 days is sufficient)
    // Fetch in descending order and reverse for chronological calculations
    const weightEntriesDesc = await prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'desc' },
      take: 90, // Last 90 days is enough for trend analysis
    });
    // Reverse to get chronological order for calculations
    const weightEntries = weightEntriesDesc.reverse();

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

    // Analyze weight trend (90 days is sufficient for adjustment calculations)
    const trendDesc = await ctx.prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'desc' },
      take: 90, // Last 90 days is enough for trend analysis
    });
    // Reverse to get chronological order for calculations
    const trend = trendDesc.reverse();

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
    suggestedKcal = Math.round(suggestedKcal / ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR) * ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR;

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

      // Get trend data for audit log (90 days is sufficient)
      const trendDesc = await prisma.weightEntry.findMany({
        where: { userId: dbUserId },
        orderBy: { logDate: 'desc' },
        take: 90, // Last 90 days is enough for trend analysis
      });
      // Reverse to get chronological order for calculations
      const trend = trendDesc.reverse();

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

      // Update profile with new calorie targets
      const newGoalKcal = input.newGoalKcal;

      // Recalculate macros based on new calories using canonical utilities
      const split = MACRO_SPLITS[profile.macroStyle];
      if (!split) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Unknown macro style: ${profile.macroStyle}`,
        });
      }
      const macros = calculateMacroTargets(newGoalKcal, profile.macroStyle);

      const updatedProfile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          goalKcal: newGoalKcal,
          proteinTargetG: macros.proteinG,
          carbsTargetG: macros.carbsG,
          fatTargetG: macros.fatG,
        },
      });

      // Check if user has an active meal plan - if so, trigger regeneration
      const activePlan = await prisma.mealPlan.findFirst({
        where: {
          userId: dbUserId,
          isActive: true,
          status: 'active',
          deletedAt: null,
        },
      });

      let planRegenerated = false;
      let regenerationJobId: string | null = null;

      if (activePlan) {
        // Build intake data from updated profile for plan regeneration
        const allergies = (Array.isArray(updatedProfile.allergies) ? updatedProfile.allergies : []) as string[];
        const exclusions = (Array.isArray(updatedProfile.exclusions) ? updatedProfile.exclusions : []) as string[];
        const cuisinePreferences = (Array.isArray(updatedProfile.cuisinePrefs) ? updatedProfile.cuisinePrefs : []) as string[];
        const trainingDays = (Array.isArray(updatedProfile.trainingDays) ? updatedProfile.trainingDays : []) as string[];

        const intakeData = {
          name: updatedProfile.name,
          sex: updatedProfile.sex as 'male' | 'female',
          age: updatedProfile.age,
          heightCm: updatedProfile.heightCm,
          weightKg: updatedProfile.weightKg,
          bodyFatPercent: updatedProfile.bodyFatPercent ?? undefined,
          goalType: updatedProfile.goalType as 'cut' | 'maintain' | 'bulk',
          goalRate: updatedProfile.goalRate,
          activityLevel: updatedProfile.activityLevel as
            | 'sedentary'
            | 'lightly_active'
            | 'moderately_active'
            | 'very_active'
            | 'extremely_active',
          trainingDays: trainingDays as Array<
            'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
          >,
          trainingTime: updatedProfile.trainingTime as 'morning' | 'afternoon' | 'evening' | undefined,
          dietaryStyle: updatedProfile.dietaryStyle as
            | 'omnivore'
            | 'vegetarian'
            | 'vegan'
            | 'pescatarian'
            | 'keto'
            | 'paleo',
          allergies,
          exclusions,
          cuisinePreferences,
          mealsPerDay: updatedProfile.mealsPerDay,
          snacksPerDay: updatedProfile.snacksPerDay,
          cookingSkill: updatedProfile.cookingSkill,
          prepTimeMaxMin: updatedProfile.prepTimeMax,
          macroStyle: updatedProfile.macroStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto',
          planDurationDays: 7,
        };

        // Create plan generation job
        const job = await prisma.planGenerationJob.create({
          data: {
            userId: dbUserId,
            status: 'pending',
            intakeData: intakeData as Prisma.InputJsonValue,
          },
        });

        regenerationJobId = job.id;

        // Enqueue BullMQ job
        const bullmqJobData: PlanGenerationJobData = {
          jobId: job.id,
          userId: dbUserId,
          intakeData: intakeData as Record<string, unknown>,
        };

        try {
          await planGenerationQueue.add('generate-plan', bullmqJobData, {
            jobId: job.id,
          });
          planRegenerated = true;
        } catch (queueError) {
          // If Redis/BullMQ is unavailable, log and continue
          // The job is still created in DB - worker will pick it up when available
          logger.warn('BullMQ enqueue failed during calorie adjustment (Redis may be unavailable):', queueError);
          planRegenerated = true; // Job was created, will be processed eventually
        }
      }

      // Create calorie adjustment audit log
      // adjustmentReason and trendAnalysis are now Prisma Json types - cast to InputJsonValue
      // Use Prisma.JsonNull for null values in Json fields
      const adjustment = await prisma.calorieAdjustment.create({
        data: {
          userId: dbUserId,
          previousGoalKcal: profile.goalKcal ?? 0,
          newGoalKcal: input.newGoalKcal,
          adjustmentReason: {
            reason: `Adaptive adjustment based on ${trend.length} weight entries`,
            profileGoalType: profile.goalType,
            profileGoalRate: profile.goalRate,
            regenerationTriggered: planRegenerated,
            regenerationJobId,
          } as Prisma.InputJsonValue,
          weightChangeKg,
          weightChangeLbs,
          trendAnalysis: trendAnalysis
            ? (trendAnalysis as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          milestoneAchieved,
          planRegenerated,
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
        planRegenerated,
        regenerationJobId,
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

  /**
   * runWeeklyCheck: Analyze weight trends and suggest calorie adjustments
   *
   * This procedure should be called once per week (e.g., on Sunday evening or Monday morning)
   * to analyze the user's weight trend and determine if a calorie adjustment is needed.
   *
   * Returns a suggestion for the user to review - does NOT auto-apply changes.
   */
  runWeeklyCheck: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    // Get user's active profile
    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found. Please complete onboarding first.',
      });
    }

    // Check if a weekly check was already performed this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentAdjustment = await prisma.calorieAdjustment.findFirst({
      where: {
        userId: dbUserId,
        createdAt: { gte: oneWeekAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get weight entries for trend analysis (at least 2 weeks of data)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const weightEntriesDesc = await prisma.weightEntry.findMany({
      where: {
        userId: dbUserId,
        logDate: { gte: twoWeeksAgo },
      },
      orderBy: { logDate: 'desc' },
      take: 14, // Up to 14 entries (daily for 2 weeks)
    });

    // Reverse to get chronological order
    const weightEntries = weightEntriesDesc.reverse();

    if (weightEntries.length < 2) {
      return {
        status: 'insufficient_data' as const,
        message: 'Need at least 2 weight entries over the past 2 weeks to analyze trends.',
        entriesFound: weightEntries.length,
        lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
      };
    }

    // Calculate weight trend
    const firstEntry = weightEntries[0];
    const lastEntry = weightEntries[weightEntries.length - 1];
    const timeSpanDays = Math.max(
      1,
      Math.round(
        (lastEntry.logDate.getTime() - firstEntry.logDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const weightChangeLbs = lastEntry.weightLbs - firstEntry.weightLbs;
    const weeklyRateLbs = (weightChangeLbs / timeSpanDays) * 7;

    // Determine if adjustment is needed based on goal type
    const goalRateLbs = profile.goalRate;
    const currentGoalKcal = profile.goalKcal ?? 0;
    let adjustmentNeeded = false;
    let suggestedKcal = currentGoalKcal;
    let adjustmentReason = 'Progress is on track - no adjustment needed.';

    // Validate BMR is available - required for safe bounds calculation
    // Throwing an error is safer than silently using a fallback value
    if (!profile.bmrKcal) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Metabolic profile is incomplete (missing BMR). Please regenerate your meal plan to recalculate metabolic data.',
      });
    }

    // Safe bounds: BMR + configured offsets
    const bmrKcal = profile.bmrKcal;
    const minSafeKcal = bmrKcal + ADAPTIVE_NUTRITION_CONFIG.SAFE_BOUNDS.MIN_ABOVE_BMR;
    const maxSafeKcal = bmrKcal + ADAPTIVE_NUTRITION_CONFIG.SAFE_BOUNDS.MAX_ABOVE_BMR;

    if (profile.goalType === 'cut') {
      const expectedRate = -goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      // Plateau detection: less than threshold lbs/week loss for 2+ weeks on a cut
      if (timeSpanDays >= 14 && weeklyRateLbs > -ADAPTIVE_NUTRITION_CONFIG.PLATEAU_THRESHOLD_LBS_PER_WEEK) {
        const decrease = Math.round(Math.abs(deviation) * ADAPTIVE_NUTRITION_CONFIG.ADJUSTMENT_MULTIPLIERS.CUT_DECREASE_PER_LB);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss has stalled (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Consider reducing calories to restart progress.`;
      }
      // Losing too slowly
      else if (deviation > 0.5) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss slower than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Decreasing calories may help.`;
      }
      // Losing too fast (risk of muscle loss)
      else if (deviation < -1) {
        const increase = Math.round(Math.abs(deviation) * 100);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        adjustmentNeeded = true;
        adjustmentReason = `Weight loss faster than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Increasing calories can help preserve muscle.`;
      }
    } else if (profile.goalType === 'bulk') {
      const expectedRate = goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      // Gaining too slowly or losing
      if (deviation < -0.5) {
        const increase = Math.round(Math.abs(deviation) * 150);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        adjustmentNeeded = true;
        adjustmentReason = `Weight gain slower than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Increasing calories will support growth.`;
      }
      // Gaining too fast (likely more fat than muscle)
      else if (deviation > 1) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        adjustmentNeeded = true;
        adjustmentReason = `Weight gain faster than target (${weeklyRateLbs.toFixed(2)} lbs/week vs ${expectedRate.toFixed(2)} target). Decreasing calories can help minimize fat gain.`;
      }
    }
    // For 'maintain' goal, check if weight is drifting significantly
    else if (profile.goalType === 'maintain') {
      if (Math.abs(weeklyRateLbs) > 0.5) {
        if (weeklyRateLbs > 0) {
          const decrease = Math.round(weeklyRateLbs * 100);
          suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
          adjustmentNeeded = true;
          adjustmentReason = `Weight is trending up (${weeklyRateLbs.toFixed(2)} lbs/week). Small calorie decrease recommended to maintain weight.`;
        } else {
          const increase = Math.round(Math.abs(weeklyRateLbs) * 100);
          suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
          adjustmentNeeded = true;
          adjustmentReason = `Weight is trending down (${weeklyRateLbs.toFixed(2)} lbs/week). Small calorie increase recommended to maintain weight.`;
        }
      }
    }

    // Round to nearest 50 calories
    suggestedKcal = Math.round(suggestedKcal / ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR) * ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR;

    const trend = {
      startWeightLbs: firstEntry.weightLbs,
      currentWeightLbs: lastEntry.weightLbs,
      weightChangeLbs: Math.round(weightChangeLbs * 10) / 10,
      weeklyRateLbs: Math.round(weeklyRateLbs * 100) / 100,
      timeSpanDays,
      entriesAnalyzed: weightEntries.length,
    };

    if (!adjustmentNeeded) {
      return {
        status: 'no_adjustment_needed' as const,
        message: adjustmentReason,
        trend,
        currentGoalKcal,
        lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
      };
    }

    return {
      status: 'adjustment_suggested' as const,
      suggestion: {
        currentGoalKcal,
        suggestedGoalKcal: suggestedKcal,
        calorieDifference: suggestedKcal - currentGoalKcal,
        reason: adjustmentReason,
        safeBounds: { min: minSafeKcal, max: maxSafeKcal },
      },
      trend,
      lastCheckDate: recentAdjustment?.createdAt.toISOString() ?? null,
    };
  }),

  /**
   * processActivitySync: Process unprocessed activity syncs and adjust daily calorie targets
   *
   * This procedure processes ActivitySync records from fitness platforms (Apple Health,
   * Google Fit, Fitbit, Oura) and adjusts the user's daily calorie target based on
   * extra activity calories burned.
   *
   * The adjustment uses a 50% replenishment rate: if you burn 500 extra calories from
   * activity, your daily target increases by 250 calories. This helps support recovery
   * while maintaining progress toward weight goals.
   *
   * Minimum threshold: 200 extra calories must be burned to trigger an adjustment.
   */
  processActivitySync: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    // Get start of today in UTC
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Get unprocessed syncs from today
    const unprocessed = await prisma.activitySync.findMany({
      where: {
        userId: dbUserId,
        processed: false,
        syncDate: { gte: startOfToday },
      },
      include: {
        connection: {
          select: {
            platform: true,
            isActive: true,
          },
        },
      },
    });

    if (unprocessed.length === 0) {
      return {
        adjusted: false,
        message: 'No unprocessed activity syncs found for today.',
        syncsProcessed: 0,
        bonusCalories: 0,
      };
    }

    // Filter out syncs from inactive connections
    const validSyncs = unprocessed.filter((sync) => sync.connection.isActive);

    if (validSyncs.length === 0) {
      return {
        adjusted: false,
        message: 'All activity syncs are from inactive connections.',
        syncsProcessed: 0,
        bonusCalories: 0,
      };
    }

    // Calculate total extra calories burned from active calories
    // activeCalories represents calories burned from activity (not BMR)
    const totalActiveCalories = validSyncs.reduce((sum, sync) => {
      return sum + (sync.activeCalories || 0);
    }, 0);

    let bonusCalories = 0;
    let adjusted = false;

    // Only adjust if significant activity (>threshold kcal)
    // This prevents tiny adjustments from minor activity differences
    if (totalActiveCalories > ADAPTIVE_NUTRITION_CONFIG.MIN_ACTIVITY_THRESHOLD_KCAL) {
      // Apply replenishment rate
      // This balances recovery needs with weight management goals
      bonusCalories = Math.round(totalActiveCalories * ADAPTIVE_NUTRITION_CONFIG.ACTIVITY_REPLENISHMENT_RATE);

      // Get user's profile to determine base targets
      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      });

      if (profile && profile.goalKcal) {
        // Extract values before transaction to ensure TypeScript narrowing works
        // (TypeScript doesn't narrow types inside async callbacks)
        const baseGoalKcal = profile.goalKcal;
        const baseProteinG = profile.proteinTargetG;
        const baseCarbsG = profile.carbsTargetG;
        const baseFatG = profile.fatTargetG;

        // CRITICAL: Use a transaction to ensure atomicity between DailyLog update
        // and ActivitySync marking. This prevents race conditions where one succeeds
        // and the other fails, which could lead to double-processing or orphaned state.
        await prisma.$transaction(async (tx) => {
          // Update or create today's DailyLog with bonus calories
          await tx.dailyLog.upsert({
            where: {
              userId_date: {
                userId: dbUserId,
                date: startOfToday,
              },
            },
            update: {
              targetKcal: { increment: bonusCalories },
            },
            create: {
              userId: dbUserId,
              date: startOfToday,
              targetKcal: baseGoalKcal + bonusCalories,
              targetProteinG: baseProteinG,
              targetCarbsG: baseCarbsG,
              targetFatG: baseFatG,
            },
          });

          // Mark all syncs as processed within the same transaction
          // This ensures atomic operation - either both succeed or both rollback
          await tx.activitySync.updateMany({
            where: {
              id: { in: validSyncs.map((s) => s.id) },
            },
            data: { processed: true },
          });
        });

        adjusted = true;

        logger.info(`[processActivitySync] Adjusted daily target for user ${dbUserId}`, {
          activeCalories: totalActiveCalories,
          bonusCalories,
          syncsProcessed: validSyncs.length,
        });
      } else {
        // No profile or goalKcal - still mark syncs as processed to prevent re-processing
        await prisma.activitySync.updateMany({
          where: {
            id: { in: validSyncs.map((s) => s.id) },
          },
          data: { processed: true },
        });
      }
    } else {
      // Below threshold - mark all syncs as processed to prevent re-processing
      await prisma.activitySync.updateMany({
        where: {
          id: { in: validSyncs.map((s) => s.id) },
        },
        data: { processed: true },
      });
    }

    return {
      adjusted,
      message: adjusted
        ? `Added ${bonusCalories} bonus calories based on ${Math.round(totalActiveCalories)} active calories burned.`
        : totalActiveCalories > 0
          ? `Activity logged (${Math.round(totalActiveCalories)} kcal) but below ${ADAPTIVE_NUTRITION_CONFIG.MIN_ACTIVITY_THRESHOLD_KCAL} kcal threshold for bonus.`
          : 'Activity syncs processed but no active calories recorded.',
      syncsProcessed: validSyncs.length,
      totalActiveCalories: Math.round(totalActiveCalories),
      bonusCalories,
      platforms: [...new Set(validSyncs.map((s) => s.connection.platform))],
    };
  }),

  /**
   * getActivitySyncStatus: Get summary of activity sync status for the dashboard
   */
  getActivitySyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    // Get start of today in UTC
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Get today's syncs
    const todaysSyncs = await prisma.activitySync.findMany({
      where: {
        userId: dbUserId,
        syncDate: { gte: startOfToday },
      },
      include: {
        connection: {
          select: {
            platform: true,
            isActive: true,
          },
        },
      },
    });

    // Get today's daily log to see current bonus
    const todaysLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: dbUserId,
          date: startOfToday,
        },
      },
    });

    // Get user profile for base target
    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    const totalActiveCalories = todaysSyncs.reduce((sum, sync) => {
      return sum + (sync.activeCalories || 0);
    }, 0);

    const processedCount = todaysSyncs.filter((s) => s.processed).length;
    const unprocessedCount = todaysSyncs.filter((s) => !s.processed).length;

    return {
      todaysSyncs: {
        total: todaysSyncs.length,
        processed: processedCount,
        unprocessed: unprocessedCount,
      },
      totalActiveCalories: Math.round(totalActiveCalories),
      bonusApplied: todaysLog?.targetKcal && profile?.goalKcal
        ? Math.max(0, todaysLog.targetKcal - profile.goalKcal)
        : 0,
      platforms: [...new Set(todaysSyncs.map((s) => s.connection.platform))],
      hasUnprocessed: unprocessedCount > 0,
    };
  }),
});
