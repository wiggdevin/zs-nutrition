import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'

/**
 * Tracking Router — handles daily summary, tracked meals queries, and macro tracking.
 */
export const trackingRouter = router({
  /**
   * getDailySummary: Returns a DailyLog with targets and actuals, plus all TrackedMeal entries for a given date.
   */
  getDailySummary: protectedProcedure
    .input(
      z.object({
        date: z.string().optional(), // ISO date string, defaults to today
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Parse date input or default to today
      const targetDate = input?.date ? new Date(input.date) : new Date()
      const dateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())

      // Fetch DailyLog and all TrackedMeals for this date in parallel
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
          orderBy: { createdAt: 'asc' },
        }),
      ])

      // Calculate totals from tracked meals for verification
      const calculatedTotals = trackedMeals.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + meal.kcal,
          proteinG: acc.proteinG + meal.proteinG,
          carbsG: acc.carbsG + meal.carbsG,
          fatG: acc.fatG + meal.fatG,
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      )

      return {
        date: dateOnly.toISOString(),
        dailyLog: dailyLog
          ? {
              id: dailyLog.id,
              targetKcal: dailyLog.targetKcal,
              targetProteinG: dailyLog.targetProteinG,
              targetCarbsG: dailyLog.targetCarbsG,
              targetFatG: dailyLog.targetFatG,
              actualKcal: dailyLog.actualKcal,
              actualProteinG: dailyLog.actualProteinG,
              actualCarbsG: dailyLog.actualCarbsG,
              actualFatG: dailyLog.actualFatG,
              adherenceScore: dailyLog.adherenceScore,
            }
          : null,
        trackedMeals: trackedMeals.map((m) => ({
          id: m.id,
          mealPlanId: m.mealPlanId,
          mealSlot: m.mealSlot,
          mealName: m.mealName,
          portion: m.portion,
          kcal: m.kcal,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          fiberG: m.fiberG,
          source: m.source,
          confidenceScore: m.confidenceScore,
          createdAt: m.createdAt,
        })),
        totals: {
          kcal: Math.round(calculatedTotals.kcal),
          proteinG: Math.round(calculatedTotals.proteinG * 10) / 10,
          carbsG: Math.round(calculatedTotals.carbsG * 10) / 10,
          fatG: Math.round(calculatedTotals.fatG * 10) / 10,
        },
        mealCount: trackedMeals.length,
      }
    }),

  /**
   * getWeeklyTrend: Returns 7 days of daily summaries for trend visualization.
   * Each day includes targets, actuals, and adherence score.
   */
  getWeeklyTrend: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date string — first day of the 7-day window
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Validate date is not in the future
      const today = new Date()
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const start = new Date(input.startDate)
      const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())

      // Disallow future dates
      if (startOnly > todayOnly) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Start date cannot be in the future',
        })
      }

      const endOnly = new Date(startOnly)
      endOnly.setDate(endOnly.getDate() + 7)

      // Fetch all DailyLogs in the 7-day range
      const dailyLogs = await prisma.dailyLog.findMany({
        where: {
          userId: dbUserId,
          date: {
            gte: startOnly,
            lt: endOnly,
          },
        },
        orderBy: { date: 'asc' },
      })

      // Also fetch TrackedMeals for this range to compute totals for days without DailyLog
      const trackedMeals = await prisma.trackedMeal.findMany({
        where: {
          userId: dbUserId,
          loggedDate: {
            gte: startOnly,
            lt: endOnly,
          },
        },
        orderBy: { loggedDate: 'asc' },
      })

      // Group tracked meals by date string
      const mealsByDate: Record<string, typeof trackedMeals> = {}
      for (const meal of trackedMeals) {
        const dateKey = new Date(
          meal.loggedDate.getFullYear(),
          meal.loggedDate.getMonth(),
          meal.loggedDate.getDate()
        ).toISOString()
        if (!mealsByDate[dateKey]) mealsByDate[dateKey] = []
        mealsByDate[dateKey].push(meal)
      }

      // Index DailyLogs by date string
      const logsByDate: Record<string, typeof dailyLogs[0]> = {}
      for (const log of dailyLogs) {
        const dateKey = new Date(
          log.date.getFullYear(),
          log.date.getMonth(),
          log.date.getDate()
        ).toISOString()
        logsByDate[dateKey] = log
      }

      // Build 7-day summary array
      const days = []
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOnly)
        dayDate.setDate(dayDate.getDate() + i)
        const dateKey = dayDate.toISOString()

        const log = logsByDate[dateKey] ?? null
        const dayMeals = mealsByDate[dateKey] ?? []

        // Compute actuals from tracked meals
        const computed = dayMeals.reduce(
          (acc, m) => ({
            kcal: acc.kcal + m.kcal,
            proteinG: acc.proteinG + m.proteinG,
            carbsG: acc.carbsG + m.carbsG,
            fatG: acc.fatG + m.fatG,
          }),
          { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        )

        days.push({
          date: dateKey,
          targets: log
            ? {
                kcal: log.targetKcal,
                proteinG: log.targetProteinG,
                carbsG: log.targetCarbsG,
                fatG: log.targetFatG,
              }
            : null,
          actuals: {
            kcal: log ? log.actualKcal : Math.round(computed.kcal),
            proteinG: log ? log.actualProteinG : Math.round(computed.proteinG * 10) / 10,
            carbsG: log ? log.actualCarbsG : Math.round(computed.carbsG * 10) / 10,
            fatG: log ? log.actualFatG : Math.round(computed.fatG * 10) / 10,
          },
          adherenceScore: log?.adherenceScore ?? null,
          mealCount: dayMeals.length,
        })
      }

      return {
        startDate: startOnly.toISOString(),
        endDate: endOnly.toISOString(),
        days,
        totalDays: 7,
      }
    }),

  /**
   * logMeal: Log a meal with macro tracking. Validates all nutritional values are non-negative.
   */
  logMeal: protectedProcedure
    .input(
      z.object({
        mealName: z.string().min(1, 'Meal name is required').max(200, 'Meal name must be 200 characters or less'),
        calories: z.number().min(0, 'Calories cannot be negative').max(10000, 'Calories must be 10000 or less'),
        protein: z.number().min(0, 'Protein cannot be negative').max(1000, 'Protein must be 1000g or less'),
        carbs: z.number().min(0, 'Carbs cannot be negative').max(1000, 'Carbs must be 1000g or less'),
        fat: z.number().min(0, 'Fat cannot be negative').max(1000, 'Fat must be 1000g or less'),
        mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack'], { errorMap: () => ({ message: 'Meal slot must be breakfast, lunch, dinner, or snack' }) }).optional(),
        date: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      const targetDate = input.date ? new Date(input.date) : new Date()
      const dateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())

      // Use a serialized transaction to prevent race conditions from concurrent requests
      const result = await prisma.$transaction(async (tx) => {
        // Create TrackedMeal
        const trackedMeal = await tx.trackedMeal.create({
          data: {
            userId: dbUserId,
            loggedDate: dateOnly,
            mealSlot: input.mealSlot || null,
            mealName: input.mealName,
            portion: 1.0,
            kcal: Math.round(input.calories),
            proteinG: Math.round(input.protein * 10) / 10,
            carbsG: Math.round(input.carbs * 10) / 10,
            fatG: Math.round(input.fat * 10) / 10,
            fiberG: null,
            source: 'manual',
            confidenceScore: 1.0,
          },
        })

        // Find or create DailyLog
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
              actualKcal: Math.round(input.calories),
              actualProteinG: Math.round(input.protein),
              actualCarbsG: Math.round(input.carbs),
              actualFatG: Math.round(input.fat),
            },
          })
        } else {
          dailyLog = await tx.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
              actualKcal: dailyLog.actualKcal + Math.round(input.calories),
              actualProteinG: dailyLog.actualProteinG + Math.round(input.protein),
              actualCarbsG: dailyLog.actualCarbsG + Math.round(input.carbs),
              actualFatG: dailyLog.actualFatG + Math.round(input.fat),
            },
          })
        }

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
          },
        }
      })

      return result
    }),
})
