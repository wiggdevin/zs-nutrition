import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { protectedProcedure, router } from '../../trpc';
import { MACRO_SPLITS, calculateMacroTargets } from '@/lib/metabolic-utils';
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue';
import { logger } from '@/lib/safe-logger';
import { calculateWeightTrend } from '../../utils/weight-trend';
import { ADAPTIVE_NUTRITION_CONFIG } from './config';

/**
 * Nutrition Adjustments sub-router — adaptive macro adjustments.
 */
export const nutritionAdjustmentsRouter = router({
  /**
   * suggestCalorieAdjustment: Analyze progress and suggest adaptive calorie changes
   */
  suggestCalorieAdjustment: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active profile found.',
      });
    }

    const trendDesc = await ctx.prisma.weightEntry.findMany({
      where: { userId: dbUserId },
      orderBy: { logDate: 'desc' },
      take: 90,
    });
    const trendEntries = trendDesc.reverse();

    if (trendEntries.length < 2) {
      return {
        hasSuggestion: false,
        reason: 'Need at least 2 weight entries to suggest adjustments',
        currentGoalKcal: profile.goalKcal,
      };
    }

    const trend = calculateWeightTrend(trendEntries)!;
    const weeklyRateLbs = trend.weeklyRateLbs;

    const goalRateLbs = profile.goalRate;
    const currentGoalKcal = profile.goalKcal ?? 0;
    let suggestedKcal: number = currentGoalKcal;
    let adjustmentReason = 'No adjustment needed - on track';
    let shouldAdjust = false;

    const minSafeKcal = Math.max(
      (profile.bmrKcal ?? 0) + 200,
      profile.sex === 'male' ? 1500 : 1200
    );
    const maxSafeKcal = (profile.bmrKcal ?? 0) + 1500;

    if (profile.goalType === 'cut') {
      const expectedRate = -goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      if (deviation > 0.5) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        shouldAdjust = true;
        adjustmentReason = `Weight loss slower than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Decreasing calories to maintain progress.`;
      } else if (deviation < -1) {
        const increase = Math.round(Math.abs(deviation) * 100);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        shouldAdjust = true;
        adjustmentReason = `Weight loss faster than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Increasing calories to prevent metabolic adaptation and preserve muscle.`;
      }
    } else if (profile.goalType === 'bulk') {
      const expectedRate = goalRateLbs;
      const deviation = weeklyRateLbs - expectedRate;

      if (deviation < -0.5) {
        const increase = Math.round(Math.abs(deviation) * 150);
        suggestedKcal = Math.min(maxSafeKcal, currentGoalKcal + increase);
        shouldAdjust = true;
        adjustmentReason = `Weight gain slower than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Increasing calories to support growth.`;
      } else if (deviation > 1) {
        const decrease = Math.round(deviation * 100);
        suggestedKcal = Math.max(minSafeKcal, currentGoalKcal - decrease);
        shouldAdjust = true;
        adjustmentReason = `Weight gain faster than target (${weeklyRateLbs.toFixed(2)} vs ${expectedRate.toFixed(2)} lbs/week). Decreasing calories to minimize fat gain.`;
      }
    }

    suggestedKcal =
      Math.round(suggestedKcal / ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR) *
      ADAPTIVE_NUTRITION_CONFIG.CALORIE_ROUNDING_FACTOR;

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
        weeklyRateLbs: trend.weeklyRateLbs,
        weightChangeLbs: trend.weightChangeLbs,
        timeSpanDays: trend.timeSpanDays,
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

      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active profile found.',
        });
      }

      if (!profile.bmrKcal) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Metabolic profile is incomplete. Please regenerate your meal plan.',
        });
      }

      const minSafeKcal = Math.max(profile.bmrKcal + 200, profile.sex === 'male' ? 1500 : 1200);
      const maxSafeKcal = profile.bmrKcal + 1500;

      if (input.newGoalKcal < minSafeKcal || input.newGoalKcal > maxSafeKcal) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Calories must be between ${minSafeKcal} and ${maxSafeKcal} for safe metabolic function.`,
        });
      }

      const trendDesc = await prisma.weightEntry.findMany({
        where: { userId: dbUserId },
        orderBy: { logDate: 'desc' },
        take: 90,
      });
      const trendEntries = trendDesc.reverse();

      let weightChangeKg: number | null = null;
      let weightChangeLbs: number | null = null;
      let trendAnalysis: Record<string, unknown> | null = null;

      if (trendEntries.length >= 2) {
        const trend = calculateWeightTrend(trendEntries)!;
        weightChangeKg = trend.weightChangeKg;
        weightChangeLbs = trend.weightChangeLbs;
        trendAnalysis = {
          timeSpanDays: trend.timeSpanDays,
          weeklyRateLbs: trend.weeklyRateLbs,
          entries: trendEntries.length,
        };
      }

      // Check for milestone
      let milestoneAchieved: string | null = null;
      if (trendEntries.length >= 2 && weightChangeLbs !== null && Math.abs(weightChangeLbs) >= 5) {
        const milestone = Math.floor(Math.abs(weightChangeLbs) / 5) * 5;
        if (milestone >= 5 && milestone <= 25) {
          milestoneAchieved = `${milestone} lbs ${weightChangeLbs > 0 ? 'gained' : 'lost'}!`;
        }
      }

      const newGoalKcal = input.newGoalKcal;

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
        const allergies = (
          Array.isArray(updatedProfile.allergies) ? updatedProfile.allergies : []
        ) as string[];
        const exclusions = (
          Array.isArray(updatedProfile.exclusions) ? updatedProfile.exclusions : []
        ) as string[];
        const cuisinePreferences = (
          Array.isArray(updatedProfile.cuisinePrefs) ? updatedProfile.cuisinePrefs : []
        ) as string[];
        const trainingDays = (
          Array.isArray(updatedProfile.trainingDays) ? updatedProfile.trainingDays : []
        ) as string[];

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
          trainingTime: updatedProfile.trainingTime as
            | 'morning'
            | 'afternoon'
            | 'evening'
            | undefined,
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
          macroStyle: updatedProfile.macroStyle as
            | 'balanced'
            | 'high_protein'
            | 'low_carb'
            | 'keto',
          planDurationDays: 7,
        };

        const job = await prisma.planGenerationJob.create({
          data: {
            userId: dbUserId,
            status: 'pending',
            intakeData: intakeData as Prisma.InputJsonValue,
          },
        });

        regenerationJobId = job.id;

        const bullmqJobData: PlanGenerationJobData = {
          jobId: job.id,
          pipelinePath: 'full',
        };

        try {
          await planGenerationQueue.add('generate-plan', bullmqJobData, {
            jobId: job.id,
          });
          planRegenerated = true;
        } catch (queueError) {
          logger.warn(
            'BullMQ enqueue failed during calorie adjustment (Redis may be unavailable):',
            queueError
          );
          planRegenerated = true;
        }
      }

      const adjustment = await prisma.calorieAdjustment.create({
        data: {
          userId: dbUserId,
          previousGoalKcal: profile.goalKcal ?? 0,
          newGoalKcal: input.newGoalKcal,
          adjustmentReason: {
            reason: `Adaptive adjustment based on ${trendEntries.length} weight entries`,
            profileGoalType: profile.goalType,
            profileGoalRate: profile.goalRate,
            regenerationTriggered: planRegenerated,
            regenerationJobId,
          } as Prisma.InputJsonValue,
          weightChangeKg,
          weightChangeLbs,
          trendAnalysis: trendAnalysis ? (trendAnalysis as Prisma.InputJsonValue) : Prisma.JsonNull,
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
});
