import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../../trpc';
import { recalculateDailyLog, calculateAdherenceScore } from '../../utils/daily-log';
import { isUniqueConstraintError } from '@/lib/prisma-utils';
import { cacheDelete, CacheKeys } from '@/lib/cache';

/**
 * Meal Mutations — write procedures for logging and managing tracked meals.
 */
export const mealMutationsRouter = router({
  /**
   * logMealFromPlan: Creates a TrackedMeal from plan data and updates DailyLog.
   */
  logMealFromPlan: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        dayNumber: z.number().int().min(1).max(7),
        slot: z.string(),
        mealName: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        fiber: z.number().optional(),
        portion: z.number().min(0.1).max(10).default(1.0),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      const today = new Date();
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

      try {
        const txResult = await prisma.$transaction(async (tx) => {
          const portionMultiplier = input.portion;
          const kcal = Math.round(input.calories * portionMultiplier);
          const proteinG = Math.round(input.protein * portionMultiplier * 10) / 10;
          const carbsG = Math.round(input.carbs * portionMultiplier * 10) / 10;
          const fatG = Math.round(input.fat * portionMultiplier * 10) / 10;
          const fiberG = input.fiber ? Math.round(input.fiber * portionMultiplier * 10) / 10 : null;

          const trackedMeal = await tx.trackedMeal.create({
            data: {
              userId: dbUserId,
              mealPlanId: input.planId,
              loggedDate: dateOnly,
              mealSlot: input.slot,
              mealName: input.mealName,
              portion: input.portion,
              kcal,
              proteinG,
              carbsG,
              fatG,
              fiberG,
              source: 'plan_meal',
              confidenceScore: 0.95,
            },
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
                targetKcal: plan.dailyKcalTarget,
                targetProteinG: plan.dailyProteinG,
                targetCarbsG: plan.dailyCarbsG,
                targetFatG: plan.dailyFatG,
                actualKcal: kcal,
                actualProteinG: Math.round(proteinG),
                actualCarbsG: Math.round(carbsG),
                actualFatG: Math.round(fatG),
              },
            });
          } else {
            dailyLog = await tx.dailyLog.update({
              where: { id: dailyLog.id },
              data: {
                actualKcal: dailyLog.actualKcal + kcal,
                actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
                actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
                actualFatG: dailyLog.actualFatG + Math.round(fatG),
              },
            });
          }

          const adherenceScore = calculateAdherenceScore(dailyLog);
          await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: { adherenceScore },
          });

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
              targetKcal: dailyLog.targetKcal,
              targetProteinG: dailyLog.targetProteinG,
              targetCarbsG: dailyLog.targetCarbsG,
              targetFatG: dailyLog.targetFatG,
              adherenceScore,
            },
            duplicate: false,
          };
        });

        // Invalidate daily summary cache
        const planDateStr = dateOnly.toISOString().slice(0, 10);
        await cacheDelete(CacheKeys.dailySummary(dbUserId, planDateStr));

        return txResult;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const existing = await prisma.trackedMeal.findFirst({
            where: {
              userId: dbUserId,
              mealPlanId: input.planId,
              loggedDate: dateOnly,
              mealSlot: input.slot,
              source: 'plan_meal',
            },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            const existingDailyLog = await prisma.dailyLog.findUnique({
              where: { userId_date: { userId: dbUserId, date: dateOnly } },
            });
            return {
              trackedMeal: {
                id: existing.id,
                mealName: existing.mealName,
                mealSlot: existing.mealSlot,
                kcal: existing.kcal,
                proteinG: existing.proteinG,
                carbsG: existing.carbsG,
                fatG: existing.fatG,
                source: existing.source,
                createdAt: existing.createdAt,
              },
              dailyLog: {
                actualKcal: existingDailyLog?.actualKcal ?? existing.kcal,
                actualProteinG: existingDailyLog?.actualProteinG ?? Math.round(existing.proteinG),
                actualCarbsG: existingDailyLog?.actualCarbsG ?? Math.round(existing.carbsG),
                actualFatG: existingDailyLog?.actualFatG ?? Math.round(existing.fatG),
                targetKcal: existingDailyLog?.targetKcal ?? null,
                targetProteinG: existingDailyLog?.targetProteinG ?? null,
                targetCarbsG: existingDailyLog?.targetCarbsG ?? null,
                targetFatG: existingDailyLog?.targetFatG ?? null,
                adherenceScore: existingDailyLog?.adherenceScore ?? 0,
              },
              duplicate: true,
            };
          }
        }
        throw error;
      }
    }),

  /**
   * quickAdd: Quickly add calories and optional macros without searching.
   */
  quickAdd: protectedProcedure
    .input(
      z.object({
        calories: z.number().int().min(1).max(10000),
        protein: z.number().min(0).max(1000).optional(),
        carbs: z.number().min(0).max(1000).optional(),
        fat: z.number().min(0).max(1000).optional(),
        mealName: z.string().max(100).optional(),
        mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
        loggedDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      let dateOnly: Date;
      if (input.loggedDate) {
        const parsed = new Date(input.loggedDate + 'T00:00:00');
        if (!isNaN(parsed.getTime())) {
          dateOnly = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
        } else {
          const today = new Date();
          dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        }
      } else {
        const today = new Date();
        dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      }

      const kcal = input.calories;
      const proteinG = input.protein ?? 0;
      const carbsG = input.carbs ?? 0;
      const fatG = input.fat ?? 0;
      const mealName = input.mealName || `Quick Add (${kcal} kcal)`;

      const quickAddResult = await prisma.$transaction(async (tx) => {
        const threeSecondsAgo = new Date(Date.now() - 3000);
        const recentDuplicate = await tx.trackedMeal.findFirst({
          where: {
            userId: dbUserId,
            loggedDate: dateOnly,
            mealName,
            kcal,
            source: 'quick_add',
            createdAt: { gte: threeSecondsAgo },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentDuplicate) {
          const dailyLog = await tx.dailyLog.findUnique({
            where: { userId_date: { userId: dbUserId, date: dateOnly } },
          });
          return {
            trackedMeal: {
              id: recentDuplicate.id,
              mealName: recentDuplicate.mealName,
              mealSlot: recentDuplicate.mealSlot,
              kcal: recentDuplicate.kcal,
              proteinG: recentDuplicate.proteinG,
              carbsG: recentDuplicate.carbsG,
              fatG: recentDuplicate.fatG,
              source: recentDuplicate.source,
              createdAt: recentDuplicate.createdAt,
            },
            dailyLog: {
              actualKcal: dailyLog?.actualKcal ?? kcal,
              actualProteinG: dailyLog?.actualProteinG ?? Math.round(proteinG),
              actualCarbsG: dailyLog?.actualCarbsG ?? Math.round(carbsG),
              actualFatG: dailyLog?.actualFatG ?? Math.round(fatG),
              targetKcal: dailyLog?.targetKcal ?? null,
              targetProteinG: dailyLog?.targetProteinG ?? null,
              targetCarbsG: dailyLog?.targetCarbsG ?? null,
              targetFatG: dailyLog?.targetFatG ?? null,
              adherenceScore: dailyLog?.adherenceScore ?? 0,
            },
            duplicate: true,
          };
        }

        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: dbUserId,
            loggedDate: dateOnly,
            mealSlot: input.mealSlot || null,
            mealName,
            portion: 1.0,
            kcal,
            proteinG,
            carbsG,
            fatG,
            fiberG: null,
            source: 'quick_add',
            confidenceScore: 1.0,
          },
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
          const activeProfile = await tx.userProfile.findFirst({
            where: { userId: dbUserId, isActive: true },
            orderBy: { createdAt: 'desc' },
          });

          dailyLog = await tx.dailyLog.create({
            data: {
              userId: dbUserId,
              date: dateOnly,
              targetKcal: activeProfile?.goalKcal || null,
              targetProteinG: activeProfile?.proteinTargetG || null,
              targetCarbsG: activeProfile?.carbsTargetG || null,
              targetFatG: activeProfile?.fatTargetG || null,
              actualKcal: kcal,
              actualProteinG: Math.round(proteinG),
              actualCarbsG: Math.round(carbsG),
              actualFatG: Math.round(fatG),
            },
          });
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + kcal,
              actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
              actualFatG: dailyLog.actualFatG + Math.round(fatG),
            },
          });
        }

        const adherenceScore = calculateAdherenceScore(dailyLog);
        await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        });

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
            targetKcal: dailyLog.targetKcal,
            targetProteinG: dailyLog.targetProteinG,
            targetCarbsG: dailyLog.targetCarbsG,
            targetFatG: dailyLog.targetFatG,
            adherenceScore,
          },
        };
      });

      // Invalidate daily summary cache
      const quickAddDateStr = dateOnly.toISOString().slice(0, 10);
      await cacheDelete(CacheKeys.dailySummary(dbUserId, quickAddDateStr));

      return quickAddResult;
    }),

  /**
   * deleteTrackedMeal: Deletes a tracked meal and recalculates the DailyLog totals.
   */
  deleteTrackedMeal: protectedProcedure
    .input(
      z.object({
        trackedMealId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const trackedMeal = await prisma.trackedMeal.findFirst({
        where: {
          id: input.trackedMealId,
          userId: dbUserId,
        },
      });

      if (!trackedMeal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tracked meal not found.',
        });
      }

      const dateOnly = new Date(
        Date.UTC(
          trackedMeal.loggedDate.getUTCFullYear(),
          trackedMeal.loggedDate.getUTCMonth(),
          trackedMeal.loggedDate.getUTCDate()
        )
      );

      await prisma.trackedMeal.delete({
        where: { id: input.trackedMealId },
      });

      // Invalidate daily summary cache
      const deleteDateStr = dateOnly.toISOString().slice(0, 10);
      await cacheDelete(CacheKeys.dailySummary(dbUserId, deleteDateStr));

      const newTotals = await recalculateDailyLog(prisma, dbUserId, dateOnly);

      const dailyLog = await prisma.dailyLog.findUnique({
        where: {
          userId_date: {
            userId: dbUserId,
            date: dateOnly,
          },
        },
      });

      if (dailyLog) {
        const updatedLog = await prisma.dailyLog.update({
          where: { id: dailyLog.id },
          data: {
            actualKcal: newTotals.actualKcal,
            actualProteinG: newTotals.actualProteinG,
            actualCarbsG: newTotals.actualCarbsG,
            actualFatG: newTotals.actualFatG,
          },
        });

        const adherenceScore = calculateAdherenceScore(updatedLog);
        await prisma.dailyLog.update({
          where: { id: updatedLog.id },
          data: { adherenceScore },
        });

        return {
          deleted: true,
          deletedMealName: trackedMeal.mealName,
          dailyLog: {
            actualKcal: newTotals.actualKcal,
            actualProteinG: newTotals.actualProteinG,
            actualCarbsG: newTotals.actualCarbsG,
            actualFatG: newTotals.actualFatG,
            targetKcal: updatedLog.targetKcal,
            targetProteinG: updatedLog.targetProteinG,
            targetCarbsG: updatedLog.targetCarbsG,
            targetFatG: updatedLog.targetFatG,
            adherenceScore,
          },
        };
      }

      return {
        deleted: true,
        deletedMealName: trackedMeal.mealName,
        dailyLog: null,
      };
    }),
});
