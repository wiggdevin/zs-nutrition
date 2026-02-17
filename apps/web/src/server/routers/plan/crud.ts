import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../../trpc';
import {
  ValidatedPlanSchema,
  MetabolicProfileSchema as MetabolicProfileDbSchema,
} from '@/lib/schemas/plan';
import { decompressJson } from '@/lib/compression';

/**
 * Plan CRUD sub-router — read-only plan queries and job status checks.
 */
export const planCrudRouter = router({
  /**
   * getActivePlan: Returns the user's currently active meal plan.
   */
  getActivePlan: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;
    const dbUserId = ctx.dbUserId;

    const plan = await prisma.mealPlan.findFirst({
      where: {
        userId: dbUserId,
        isActive: true,
        status: 'active',
        deletedAt: null,
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        trainingBonusKcal: true,
        planDays: true,
        startDate: true,
        endDate: true,
        qaScore: true,
        qaStatus: true,
        status: true,
        isActive: true,
        validatedPlan: true,
        metabolicProfile: true,
      },
    });

    if (!plan) return null;

    // Decompress before Zod validation (handles both compressed and legacy data)
    const decompressedPlan = decompressJson(plan.validatedPlan);
    const decompressedMetabolic = decompressJson(plan.metabolicProfile);

    const parsedPlan = ValidatedPlanSchema.safeParse(decompressedPlan).success
      ? (decompressedPlan as z.infer<typeof ValidatedPlanSchema>)
      : { days: [] };
    const parsedMetabolic = MetabolicProfileDbSchema.safeParse(decompressedMetabolic).success
      ? (decompressedMetabolic as z.infer<typeof MetabolicProfileDbSchema>)
      : {};

    return {
      id: plan.id,
      dailyKcalTarget: plan.dailyKcalTarget,
      dailyProteinG: plan.dailyProteinG,
      dailyCarbsG: plan.dailyCarbsG,
      dailyFatG: plan.dailyFatG,
      trainingBonusKcal: plan.trainingBonusKcal,
      planDays: plan.planDays,
      startDate: plan.startDate,
      endDate: plan.endDate,
      qaScore: plan.qaScore,
      qaStatus: plan.qaStatus,
      status: plan.status,
      isActive: plan.isActive,
      validatedPlan: parsedPlan,
      metabolicProfile: parsedMetabolic,
    };
  }),

  /**
   * getPlanById: Returns a specific meal plan by ID (only if owned by user).
   */
  getPlanById: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const plan = await prisma.mealPlan.findFirst({
        where: {
          id: input.planId,
          userId: dbUserId,
          deletedAt: null,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meal plan not found.',
        });
      }

      // Decompress before Zod validation (handles both compressed and legacy data)
      const decompressedPlan = decompressJson(plan.validatedPlan);
      const decompressedMetabolic = decompressJson(plan.metabolicProfile);

      const parsedPlan = ValidatedPlanSchema.safeParse(decompressedPlan).success
        ? (decompressedPlan as z.infer<typeof ValidatedPlanSchema>)
        : { days: [] };
      const parsedMetabolic = MetabolicProfileDbSchema.safeParse(decompressedMetabolic).success
        ? (decompressedMetabolic as z.infer<typeof MetabolicProfileDbSchema>)
        : {};

      return {
        id: plan.id,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        trainingBonusKcal: plan.trainingBonusKcal,
        planDays: plan.planDays,
        startDate: plan.startDate,
        endDate: plan.endDate,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        status: plan.status,
        validatedPlan: parsedPlan,
        metabolicProfile: parsedMetabolic,
      };
    }),

  /**
   * getJobStatus: Check the current status of a plan generation job.
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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
          message: 'Job not found.',
        });
      }

      const parsedProgress = job.progress as Record<string, unknown> | null;
      const parsedResult = (job.result as { planId?: string } | null) || {};
      const parsedPlanId = parsedResult.planId;

      return {
        status: job.status,
        currentAgent: job.currentAgent,
        progress: parsedProgress,
        error: job.error,
        planId: parsedPlanId,
      };
    }),
});
