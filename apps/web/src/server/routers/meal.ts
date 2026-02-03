import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { TRPCError } from '@trpc/server'

/**
 * Meal Router — handles logging meals from plan, tracking, and daily logs.
 */
export const mealRouter = router({
  /**
   * getActivePlan: Returns the user's active meal plan with parsed validated plan data.
   */
  getActivePlan: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx
    const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

    const plan = await prisma.mealPlan.findFirst({
      where: {
        userId: dbUserId,
        isActive: true,
        status: 'active',
      },
      orderBy: { generatedAt: 'desc' },
    })

    if (!plan) return null

    let parsedPlan: Record<string, unknown> = {}
    try {
      parsedPlan = JSON.parse(plan.validatedPlan)
    } catch {
      /* empty plan */
    }

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
      generatedAt: plan.generatedAt,
      validatedPlan: parsedPlan,
    }
  }),

  /**
   * getTodaysPlanMeals: Extract today's meals from the active plan.
   * Uses the plan's day structure to find the right day.
   */
  getTodaysPlanMeals: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      const plan = await prisma.mealPlan.findFirst({
        where: {
          userId: dbUserId,
          isActive: true,
          status: 'active',
        },
        orderBy: { generatedAt: 'desc' },
      })

      if (!plan) return { meals: [], planId: null }

      let parsedPlan: Record<string, unknown> = {}
      try {
        parsedPlan = JSON.parse(plan.validatedPlan)
      } catch {
        return { meals: [], planId: plan.id }
      }

      // Figure out which day of the plan we're on
      const today = input?.date ? new Date(input.date) : new Date()
      const startDate = plan.startDate ? new Date(plan.startDate) : new Date(plan.generatedAt)
      const dayDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const dayNumber = (dayDiff % plan.planDays) + 1 // 1-indexed, wraps around

      // Extract meals for this day from the validated plan
      const days = (parsedPlan.days || []) as Array<Record<string, unknown>>
      const todayPlan = days.find((d) => d.dayNumber === dayNumber) || days[0]

      if (!todayPlan) return { meals: [], planId: plan.id }

      const meals = ((todayPlan.meals || []) as Array<Record<string, unknown>>).map((meal) => {
        const nutrition = (meal.nutrition || meal.estimatedNutrition || {}) as Record<string, unknown>
        return {
          slot: (meal.slot as string) || 'meal',
          name: (meal.name as string) || 'Unknown Meal',
          cuisine: (meal.cuisine as string) || '',
          prepTimeMin: (meal.prepTimeMin as number) || 0,
          cookTimeMin: (meal.cookTimeMin as number) || 0,
          calories: (nutrition.kcal as number) || (nutrition.calories as number) || 0,
          protein: (nutrition.proteinG as number) || (nutrition.protein as number) || 0,
          carbs: (nutrition.carbsG as number) || (nutrition.carbs as number) || 0,
          fat: (nutrition.fatG as number) || (nutrition.fat as number) || 0,
          fiber: (nutrition.fiberG as number) || 0,
          confidenceLevel: (meal.confidenceLevel as string) || 'ai_estimated',
          dayNumber,
        }
      })

      return { meals, planId: plan.id, dayNumber }
    }),

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
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Verify the plan belongs to this user
      const plan = await prisma.mealPlan.findFirst({
        where: {
          id: input.planId,
          userId: dbUserId,
        },
      })

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meal plan not found.',
        })
      }

      // Use UTC midnight for consistent date handling
      const today = new Date()
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

      // Use a serialized transaction to prevent race conditions from concurrent tabs
      return await prisma.$transaction(async (tx) => {
        // Duplicate detection: check if an identical plan meal was logged in the last 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10000)
        const recentDuplicate = await tx.trackedMeal.findFirst({
          where: {
            userId: dbUserId,
            mealPlanId: input.planId,
            loggedDate: dateOnly,
            mealSlot: input.slot,
            mealName: input.mealName,
            source: 'plan_meal',
            createdAt: { gte: tenSecondsAgo },
          },
          orderBy: { createdAt: 'desc' },
        })

        if (recentDuplicate) {
          const existingDailyLog = await tx.dailyLog.findUnique({
            where: { userId_date: { userId: dbUserId, date: dateOnly } },
          })
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
              actualKcal: existingDailyLog?.actualKcal ?? recentDuplicate.kcal,
              actualProteinG: existingDailyLog?.actualProteinG ?? Math.round(recentDuplicate.proteinG),
              actualCarbsG: existingDailyLog?.actualCarbsG ?? Math.round(recentDuplicate.carbsG),
              actualFatG: existingDailyLog?.actualFatG ?? Math.round(recentDuplicate.fatG),
              targetKcal: existingDailyLog?.targetKcal ?? null,
              targetProteinG: existingDailyLog?.targetProteinG ?? null,
              targetCarbsG: existingDailyLog?.targetCarbsG ?? null,
              targetFatG: existingDailyLog?.targetFatG ?? null,
              adherenceScore: existingDailyLog?.adherenceScore ?? 0,
            },
            duplicate: true,
          }
        }

        // Apply portion multiplier
        const portionMultiplier = input.portion
        const kcal = Math.round(input.calories * portionMultiplier)
        const proteinG = Math.round(input.protein * portionMultiplier * 10) / 10
        const carbsG = Math.round(input.carbs * portionMultiplier * 10) / 10
        const fatG = Math.round(input.fat * portionMultiplier * 10) / 10
        const fiberG = input.fiber ? Math.round(input.fiber * portionMultiplier * 10) / 10 : null

        // Create TrackedMeal
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
        })

        // Find or create DailyLog for today
        let dailyLog = await tx.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
        })

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
          })
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + kcal,
              actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
              actualFatG: dailyLog.actualFatG + Math.round(fatG),
            },
          })
        }

        // Calculate adherence score
        const adherenceScore = calculateAdherenceScore(dailyLog)
        await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        })

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
        }
      })
    }),

  /**
   * quickAdd: Quickly add calories and optional macros without searching.
   * Creates a TrackedMeal with source 'quick_add' and updates DailyLog.
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
        loggedDate: z.string().optional(), // YYYY-MM-DD format
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Use provided loggedDate or default to today
      let dateOnly: Date
      if (input.loggedDate) {
        const parsed = new Date(input.loggedDate + 'T00:00:00')
        if (!isNaN(parsed.getTime())) {
          // Use UTC midnight for consistent date handling
          dateOnly = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
        } else {
          const today = new Date()
          dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
        }
      } else {
        const today = new Date()
        dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
      }

      const kcal = input.calories
      const proteinG = input.protein ?? 0
      const carbsG = input.carbs ?? 0
      const fatG = input.fat ?? 0
      const mealName = input.mealName || `Quick Add (${kcal} kcal)`

      // Use a serialized transaction to prevent race conditions from concurrent tabs
      // The transaction ensures the duplicate check + create are atomic
      return await prisma.$transaction(async (tx) => {
        // Duplicate detection: check if an identical meal was logged in the last 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10000)
        const recentDuplicate = await tx.trackedMeal.findFirst({
          where: {
            userId: dbUserId,
            loggedDate: dateOnly,
            mealName,
            kcal,
            source: 'quick_add',
            createdAt: { gte: tenSecondsAgo },
          },
          orderBy: { createdAt: 'desc' },
        })

        if (recentDuplicate) {
          // Return the existing entry instead of creating a duplicate
          const dailyLog = await tx.dailyLog.findUnique({
            where: { userId_date: { userId: dbUserId, date: dateOnly } },
          })
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
          }
        }

        // Create TrackedMeal with source 'quick_add'
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
            confidenceScore: 1.0, // User-entered data has full confidence
          },
        })

        // Find or create DailyLog for today
        // Get user's active profile for targets
        const activeProfile = await tx.userProfile.findFirst({
          where: { userId: dbUserId, isActive: true },
          orderBy: { createdAt: 'desc' },
        })

        let dailyLog = await tx.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
        })

        if (!dailyLog) {
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
          })
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + kcal,
              actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
              actualFatG: dailyLog.actualFatG + Math.round(fatG),
            },
          })
        }

        // Calculate adherence score
        const adherenceScore = calculateAdherenceScore(dailyLog)
        await tx.dailyLog.update({
          where: { id: dailyLog.id },
          data: { adherenceScore },
        })

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
        }
      })
    }),

  /**
   * getTodaysLog: Get today's tracked meals and daily log summary.
   */
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
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Find the tracked meal, ensuring it belongs to this user
      const trackedMeal = await prisma.trackedMeal.findFirst({
        where: {
          id: input.trackedMealId,
          userId: dbUserId,
        },
      })

      if (!trackedMeal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tracked meal not found.',
        })
      }

      // Use toLocalDay to ensure consistent date handling (UTC midnight)
      const dateOnly = new Date(Date.UTC(
        trackedMeal.loggedDate.getUTCFullYear(),
        trackedMeal.loggedDate.getUTCMonth(),
        trackedMeal.loggedDate.getUTCDate()
      ))

      // Delete the tracked meal
      await prisma.trackedMeal.delete({
        where: { id: input.trackedMealId },
      })

      // Recalculate DailyLog totals from remaining tracked meals
      const remainingMeals = await prisma.trackedMeal.findMany({
        where: {
          userId: dbUserId,
          loggedDate: dateOnly,
        },
      })

      const newTotals = remainingMeals.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + meal.kcal,
          proteinG: acc.proteinG + meal.proteinG,
          carbsG: acc.carbsG + meal.carbsG,
          fatG: acc.fatG + meal.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      )

      // Update the DailyLog
      const dailyLog = await prisma.dailyLog.findUnique({
        where: {
          userId_date: {
            userId: dbUserId,
            date: dateOnly,
          },
        },
      })

      if (dailyLog) {
        const updatedLog = await prisma.dailyLog.update({
          where: { id: dailyLog.id },
          data: {
            actualKcal: Math.round(newTotals.kcal),
            actualProteinG: Math.round(newTotals.proteinG),
            actualCarbsG: Math.round(newTotals.carbsG),
            actualFatG: Math.round(newTotals.fatG),
          },
        })

        // Recalculate adherence score
        const adherenceScore = calculateAdherenceScore(updatedLog)
        await prisma.dailyLog.update({
          where: { id: updatedLog.id },
          data: { adherenceScore },
        })

        return {
          deleted: true,
          deletedMealName: trackedMeal.mealName,
          dailyLog: {
            actualKcal: Math.round(newTotals.kcal),
            actualProteinG: Math.round(newTotals.proteinG),
            actualCarbsG: Math.round(newTotals.carbsG),
            actualFatG: Math.round(newTotals.fatG),
            targetKcal: updatedLog.targetKcal,
            targetProteinG: updatedLog.targetProteinG,
            targetCarbsG: updatedLog.targetCarbsG,
            targetFatG: updatedLog.targetFatG,
            adherenceScore,
          },
        }
      }

      return {
        deleted: true,
        deletedMealName: trackedMeal.mealName,
        dailyLog: null,
      }
    }),

  getTodaysLog: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Use UTC midnight for consistent date handling
      const today = input?.date ? new Date(input.date) : new Date()
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

      const [dailyLog, trackedMeals] = await Promise.all([
        prisma.dailyLog.findUnique({
          where: {
            userId_date: {
              userId: dbUserId,
              date: dateOnly,
            },
          },
        }),
        prisma.trackedMeal.findMany({
          where: {
            userId: dbUserId,
            loggedDate: dateOnly,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      return {
        dailyLog: dailyLog
          ? {
              actualKcal: dailyLog.actualKcal,
              actualProteinG: dailyLog.actualProteinG,
              actualCarbsG: dailyLog.actualCarbsG,
              actualFatG: dailyLog.actualFatG,
              targetKcal: dailyLog.targetKcal,
              targetProteinG: dailyLog.targetProteinG,
              targetCarbsG: dailyLog.targetCarbsG,
              targetFatG: dailyLog.targetFatG,
              adherenceScore: dailyLog.adherenceScore,
            }
          : null,
        entries: trackedMeals.map((m) => ({
          id: m.id,
          mealName: m.mealName,
          mealSlot: m.mealSlot,
          kcal: m.kcal,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          source: m.source as 'plan_meal' | 'fatsecret_search' | 'quick_add' | 'manual',
          createdAt: m.createdAt,
        })),
      }
    }),
})

/**
 * Calculate adherence score (0-100) based on how close actuals are to targets.
 */
function calculateAdherenceScore(dailyLog: {
  actualKcal: number
  actualProteinG: number
  actualCarbsG: number
  actualFatG: number
  targetKcal: number | null
  targetProteinG: number | null
  targetCarbsG: number | null
  targetFatG: number | null
}): number {
  const targets = {
    kcal: dailyLog.targetKcal || 2000,
    protein: dailyLog.targetProteinG || 150,
    carbs: dailyLog.targetCarbsG || 200,
    fat: dailyLog.targetFatG || 65,
  }

  // Score each macro: 100 if exact, decreasing as you deviate
  // Being under target is slightly better than being over
  function macroScore(actual: number, target: number): number {
    if (target === 0) return 100
    const ratio = actual / target
    if (ratio <= 1) {
      // Under target: score from 0-100 based on how close
      return Math.round(ratio * 100)
    } else {
      // Over target: penalize going over
      const overBy = ratio - 1
      return Math.max(0, Math.round(100 - overBy * 200))
    }
  }

  const kcalScore = macroScore(dailyLog.actualKcal, targets.kcal)
  const proteinScore = macroScore(dailyLog.actualProteinG, targets.protein)
  const carbsScore = macroScore(dailyLog.actualCarbsG, targets.carbs)
  const fatScore = macroScore(dailyLog.actualFatG, targets.fat)

  // Weighted average: calories and protein matter more
  const score = Math.round(kcalScore * 0.35 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.15)
  return Math.min(100, Math.max(0, score))
}
