import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { protectedProcedure, router } from '../../trpc';
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue';
import { logger } from '@/lib/safe-logger';
import { isUniqueConstraintError } from '@/lib/plan-utils';

/**
 * Zod schema for the raw intake form data passed to generatePlan.
 */
const RawIntakeFormSchema = z.object({
  name: z.string().min(1),
  sex: z.enum(['male', 'female']),
  age: z.number().int().min(18).max(100),
  heightFeet: z.number().optional(),
  heightInches: z.number().optional(),
  heightCm: z.number().optional(),
  weightLbs: z.number().optional(),
  weightKg: z.number().optional(),
  bodyFatPercent: z.number().min(3).max(60).optional(),
  goalType: z.enum(['cut', 'maintain', 'bulk']),
  goalRate: z.number().min(0).max(2),
  activityLevel: z.enum([
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ]),
  trainingDays: z.array(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  ),
  trainingTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
  dietaryStyle: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo']),
  allergies: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  cuisinePreferences: z.array(z.string()).default([]),
  mealsPerDay: z.number().int().min(2).max(6),
  snacksPerDay: z.number().int().min(0).max(4),
  cookingSkill: z.number().int().min(1).max(10),
  prepTimeMaxMin: z.number().int().min(10).max(120),
  macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto']),
  planDurationDays: z.number().int().min(1).max(7).default(7),
});

/**
 * Schema for the pipeline result that contains the validated plan data.
 */
const MetabolicProfileSchema = z
  .object({
    bmrKcal: z.number(),
    tdeeKcal: z.number(),
    goalKcal: z.number(),
    proteinTargetG: z.number(),
    carbsTargetG: z.number(),
    fatTargetG: z.number(),
  })
  .passthrough();

const PlanResultSchema = z.object({
  validatedPlan: z.record(z.unknown()),
  metabolicProfile: MetabolicProfileSchema,
  dailyKcalTarget: z.number().int(),
  dailyProteinG: z.number().int(),
  dailyCarbsG: z.number().int(),
  dailyFatG: z.number().int(),
  trainingBonusKcal: z.number().int().optional().default(0),
  planDays: z.number().int().min(1).max(7).default(7),
  qaScore: z.number().int().min(0).max(100),
  qaStatus: z.enum(['PASS', 'WARN', 'FAIL']),
});

/**
 * Plan Generation sub-router — plan creation, completion, and regeneration.
 */
export const planGenerationRouter = router({
  /**
   * generatePlan: Creates a job and enqueues it for processing.
   */
  generatePlan: protectedProcedure.input(RawIntakeFormSchema).mutation(async ({ ctx, input }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const job = await prisma.planGenerationJob.create({
      data: {
        userId: dbUserId,
        status: 'pending',
        intakeData: input as Prisma.InputJsonValue,
      },
    });

    const bullmqJobData: PlanGenerationJobData = {
      jobId: job.id,
      userId: dbUserId,
      intakeData: input as Record<string, unknown>,
    };

    try {
      await planGenerationQueue.add('generate-plan', bullmqJobData, {
        jobId: job.id,
      });
    } catch (queueError) {
      logger.warn('BullMQ enqueue failed (Redis may be unavailable):', queueError);
    }

    return { jobId: job.id };
  }),

  /**
   * completeJob: Called when plan generation finishes.
   */
  completeJob: protectedProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        planResult: PlanResultSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const job = await prisma.planGenerationJob.findFirst({
        where: {
          id: input.jobId,
          userId: dbUserId,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan generation job not found.',
        });
      }

      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No active user profile found. Complete onboarding first.',
        });
      }

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + input.planResult.planDays);

      let mealPlan;
      try {
        mealPlan = await prisma.$transaction(async (tx) => {
          await tx.mealPlan.updateMany({
            where: { userId: dbUserId, isActive: true, deletedAt: null },
            data: { isActive: false, status: 'replaced' },
          });

          return tx.mealPlan.create({
            data: {
              userId: dbUserId,
              profileId: profile.id,
              validatedPlan: input.planResult.validatedPlan as Prisma.InputJsonValue,
              metabolicProfile: input.planResult.metabolicProfile as Prisma.InputJsonValue,
              dailyKcalTarget: input.planResult.dailyKcalTarget,
              dailyProteinG: input.planResult.dailyProteinG,
              dailyCarbsG: input.planResult.dailyCarbsG,
              dailyFatG: input.planResult.dailyFatG,
              trainingBonusKcal: input.planResult.trainingBonusKcal,
              planDays: input.planResult.planDays,
              startDate,
              endDate,
              qaScore: input.planResult.qaScore,
              qaStatus: input.planResult.qaStatus,
              status: 'active',
              isActive: true,
            },
          });
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          logger.warn(`[completeJob] Unique constraint hit, retrying with forced deactivation`);

          await prisma.mealPlan.updateMany({
            where: { userId: dbUserId, isActive: true, deletedAt: null },
            data: { isActive: false, status: 'replaced' },
          });

          mealPlan = await prisma.mealPlan.create({
            data: {
              userId: dbUserId,
              profileId: profile.id,
              validatedPlan: input.planResult.validatedPlan as Prisma.InputJsonValue,
              metabolicProfile: input.planResult.metabolicProfile as Prisma.InputJsonValue,
              dailyKcalTarget: input.planResult.dailyKcalTarget,
              dailyProteinG: input.planResult.dailyProteinG,
              dailyCarbsG: input.planResult.dailyCarbsG,
              dailyFatG: input.planResult.dailyFatG,
              trainingBonusKcal: input.planResult.trainingBonusKcal,
              planDays: input.planResult.planDays,
              startDate,
              endDate,
              qaScore: input.planResult.qaScore,
              qaStatus: input.planResult.qaStatus,
              status: 'active',
              isActive: true,
            },
          });
        } else {
          throw error;
        }
      }

      await prisma.planGenerationJob.update({
        where: { id: input.jobId },
        data: {
          status: 'completed',
          result: { planId: mealPlan.id },
          completedAt: new Date(),
        },
      });

      return {
        planId: mealPlan.id,
        status: 'active',
        isActive: true,
        dailyKcalTarget: mealPlan.dailyKcalTarget,
        qaScore: mealPlan.qaScore,
        qaStatus: mealPlan.qaStatus,
      };
    }),

  /**
   * regeneratePlan: Regenerates a meal plan using the user's current active profile.
   */
  regeneratePlan: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const profile = await prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No active user profile found. Complete onboarding first.',
      });
    }

    const allergies = (Array.isArray(profile.allergies) ? profile.allergies : []) as string[];
    const exclusions = (Array.isArray(profile.exclusions) ? profile.exclusions : []) as string[];
    const cuisinePreferences = (
      Array.isArray(profile.cuisinePrefs) ? profile.cuisinePrefs : []
    ) as string[];
    const trainingDays = (
      Array.isArray(profile.trainingDays) ? profile.trainingDays : []
    ) as string[];

    const intakeData = {
      name: profile.name,
      sex: profile.sex as 'male' | 'female',
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      bodyFatPercent: profile.bodyFatPercent ?? undefined,
      goalType: profile.goalType as 'cut' | 'maintain' | 'bulk',
      goalRate: profile.goalRate,
      activityLevel: profile.activityLevel as
        | 'sedentary'
        | 'lightly_active'
        | 'moderately_active'
        | 'very_active'
        | 'extremely_active',
      trainingDays: trainingDays as Array<
        'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
      >,
      trainingTime: profile.trainingTime as 'morning' | 'afternoon' | 'evening' | undefined,
      dietaryStyle: profile.dietaryStyle as
        | 'omnivore'
        | 'vegetarian'
        | 'vegan'
        | 'pescatarian'
        | 'keto'
        | 'paleo',
      allergies,
      exclusions,
      cuisinePreferences,
      mealsPerDay: profile.mealsPerDay,
      snacksPerDay: profile.snacksPerDay,
      cookingSkill: profile.cookingSkill,
      prepTimeMaxMin: profile.prepTimeMax,
      macroStyle: profile.macroStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto',
      planDurationDays: 7,
    };

    const job = await prisma.planGenerationJob.create({
      data: {
        userId: dbUserId,
        status: 'pending',
        intakeData: intakeData as Prisma.InputJsonValue,
      },
    });

    const bullmqJobData: PlanGenerationJobData = {
      jobId: job.id,
      userId: dbUserId,
      intakeData: intakeData as Record<string, unknown>,
    };

    try {
      await planGenerationQueue.add('generate-plan', bullmqJobData, {
        jobId: job.id,
      });
    } catch (queueError) {
      logger.warn('BullMQ enqueue failed (Redis may be unavailable):', queueError);
    }

    return { jobId: job.id };
  }),
});
