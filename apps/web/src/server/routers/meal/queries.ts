import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc';
import { ValidatedPlanSchema } from '@/lib/schemas/plan';

/**
 * Meal Queries — read-only procedures for meal plans and daily logs.
 */
export const mealQueriesRouter = router({
  /**
   * getActivePlan: Returns the user's active meal plan with parsed validated plan data.
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
        generatedAt: true,
        validatedPlan: true,
      },
    });

    if (!plan) return null;

    const parsedPlan = ValidatedPlanSchema.safeParse(plan.validatedPlan).success
      ? (plan.validatedPlan as z.infer<typeof ValidatedPlanSchema>)
      : { days: [] };

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
    };
  }),

  /**
   * getTodaysPlanMeals: Extract today's meals from the active plan.
   */
  getTodaysPlanMeals: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
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
          validatedPlan: true,
          startDate: true,
          generatedAt: true,
          planDays: true,
        },
      });

      if (!plan) return { meals: [], planId: null };

      const parsedPlan = ValidatedPlanSchema.safeParse(plan.validatedPlan).success
        ? (plan.validatedPlan as z.infer<typeof ValidatedPlanSchema>)
        : { days: [] };
      if (!parsedPlan.days.length) return { meals: [], planId: plan.id };

      const today = input?.date ? new Date(input.date) : new Date();
      const startDate = plan.startDate ? new Date(plan.startDate) : new Date(plan.generatedAt);
      const dayDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayNumber = (dayDiff % plan.planDays) + 1;

      const days = parsedPlan.days;
      const todayPlan = days.find((d) => d.dayNumber === dayNumber) || days[0];

      if (!todayPlan) return { meals: [], planId: plan.id };

      const meals = (todayPlan.meals || []).map((meal) => {
        const nutrition = meal.nutrition || meal.estimatedNutrition || {};
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
        };
      });

      return { meals, planId: plan.id, dayNumber };
    }),

  /**
   * getTodaysLog: Get today's tracked meals and daily log summary.
   */
  getTodaysLog: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const dbUserId = ctx.dbUserId;

      const today = input?.date ? new Date(input.date) : new Date();
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

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
          take: 50,
        }),
      ]);

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
          source: m.source as
            | 'plan_meal'
            | 'fatsecret_search'
            | 'quick_add'
            | 'manual'
            | 'food_scan',
          createdAt: m.createdAt,
        })),
      };
    }),
});
