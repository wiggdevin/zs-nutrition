import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext } from '@/test/trpc-test-utils';

// Mock the daily-log utility
vi.mock('@/server/utils/daily-log', () => ({
  calculateAdherenceScore: vi.fn(() => 85),
  recalculateDailyLog: vi.fn(() => ({
    actualKcal: 500,
    actualProteinG: 40,
    actualCarbsG: 50,
    actualFatG: 15,
    mealCount: 1,
  })),
}));

describe('meal router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logMealFromPlan', () => {
    it('throws NOT_FOUND when plan does not exist', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(null);

      await expect(
        caller.meal.logMealFromPlan({
          planId: 'non-existent-plan',
          dayNumber: 1,
          slot: 'breakfast',
          mealName: 'Oatmeal',
          calories: 400,
          protein: 10,
          carbs: 60,
          fat: 8,
          portion: 1.0,
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Meal plan not found.',
      });
    });

    it('returns duplicate when meal already logged today', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        deletedAt: null,
      };

      const existingMeal = {
        id: 'meal-existing',
        userId: 'user-123',
        mealPlanId: 'plan-123',
        loggedDate: new Date(),
        mealSlot: 'breakfast',
        mealName: 'Oatmeal',
        portion: 1.0,
        kcal: 400,
        proteinG: 10.0,
        carbsG: 60.0,
        fatG: 8.0,
        fiberG: null,
        source: 'plan_meal',
        confidenceScore: 0.95,
        createdAt: new Date(),
      };

      const existingDailyLog = {
        id: 'log-123',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 400,
        actualProteinG: 10,
        actualCarbsG: 60,
        actualFatG: 8,
        adherenceScore: 85,
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(existingMeal),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(existingDailyLog),
          },
        });
      });

      const result = await caller.meal.logMealFromPlan({
        planId: 'plan-123',
        dayNumber: 1,
        slot: 'breakfast',
        mealName: 'Oatmeal',
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 8,
        portion: 1.0,
      });

      expect(result.duplicate).toBe(true);
      expect(result.trackedMeal.id).toBe('meal-existing');
    });

    it('creates new tracked meal and updates daily log', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        deletedAt: null,
      };

      const newMeal = {
        id: 'meal-new',
        userId: 'user-123',
        mealPlanId: 'plan-123',
        loggedDate: new Date(),
        mealSlot: 'lunch',
        mealName: 'Chicken Salad',
        portion: 1.0,
        kcal: 600,
        proteinG: 50.0,
        carbsG: 40.0,
        fatG: 20.0,
        fiberG: 8.0,
        source: 'plan_meal',
        confidenceScore: 0.95,
        createdAt: new Date(),
      };

      const newDailyLog = {
        id: 'log-new',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 600,
        actualProteinG: 50,
        actualCarbsG: 40,
        actualFatG: 20,
        adherenceScore: 85,
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newMeal),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newDailyLog),
            update: vi.fn().mockResolvedValue(newDailyLog),
          },
        });
      });

      const result = await caller.meal.logMealFromPlan({
        planId: 'plan-123',
        dayNumber: 1,
        slot: 'lunch',
        mealName: 'Chicken Salad',
        calories: 600,
        protein: 50,
        carbs: 40,
        fat: 20,
        fiber: 8,
        portion: 1.0,
      });

      expect(result.duplicate).toBeUndefined();
      expect(result.trackedMeal.mealName).toBe('Chicken Salad');
      expect(result.trackedMeal.kcal).toBe(600);
      expect(result.dailyLog.actualKcal).toBe(600);
    });

    it('applies portion multiplier correctly', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        deletedAt: null,
      };

      // With portion 1.5, values should be multiplied
      const newMeal = {
        id: 'meal-portion',
        userId: 'user-123',
        mealPlanId: 'plan-123',
        loggedDate: new Date(),
        mealSlot: 'dinner',
        mealName: 'Steak',
        portion: 1.5,
        kcal: 750, // 500 * 1.5
        proteinG: 60.0, // 40 * 1.5
        carbsG: 15.0, // 10 * 1.5
        fatG: 30.0, // 20 * 1.5
        fiberG: null,
        source: 'plan_meal',
        confidenceScore: 0.95,
        createdAt: new Date(),
      };

      const newDailyLog = {
        id: 'log-portion',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 750,
        actualProteinG: 60,
        actualCarbsG: 15,
        actualFatG: 30,
        adherenceScore: 85,
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newMeal),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newDailyLog),
            update: vi.fn().mockResolvedValue(newDailyLog),
          },
        });
      });

      const result = await caller.meal.logMealFromPlan({
        planId: 'plan-123',
        dayNumber: 1,
        slot: 'dinner',
        mealName: 'Steak',
        calories: 500,
        protein: 40,
        carbs: 10,
        fat: 20,
        portion: 1.5,
      });

      expect(result.trackedMeal.kcal).toBe(750);
      expect(result.trackedMeal.proteinG).toBe(60.0);
    });
  });

  describe('quickAdd', () => {
    it('creates a quick add entry with minimal data', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const quickAddMeal = {
        id: 'meal-quick',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date(),
        mealSlot: null,
        mealName: 'Quick Add (500 kcal)',
        portion: 1.0,
        kcal: 500,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: null,
        source: 'quick_add',
        confidenceScore: 1.0,
        createdAt: new Date(),
      };

      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        isActive: true,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        createdAt: new Date(),
      };

      const dailyLog = {
        id: 'log-quick',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 500,
        actualProteinG: 0,
        actualCarbsG: 0,
        actualFatG: 0,
        adherenceScore: 85,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(quickAddMeal),
          },
          userProfile: {
            findFirst: vi.fn().mockResolvedValue(mockProfile),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(dailyLog),
            update: vi.fn().mockResolvedValue(dailyLog),
          },
        });
      });

      const result = await caller.meal.quickAdd({
        calories: 500,
      });

      expect(result.trackedMeal.mealName).toBe('Quick Add (500 kcal)');
      expect(result.trackedMeal.kcal).toBe(500);
      expect(result.trackedMeal.source).toBe('quick_add');
    });

    it('detects and returns duplicate within 3 seconds', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const existingQuickAdd = {
        id: 'meal-existing-quick',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date(),
        mealSlot: 'snack',
        mealName: 'Protein Bar',
        portion: 1.0,
        kcal: 200,
        proteinG: 20,
        carbsG: 15,
        fatG: 8,
        fiberG: null,
        source: 'quick_add',
        confidenceScore: 1.0,
        createdAt: new Date(), // Just created
      };

      const existingDailyLog = {
        id: 'log-existing',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 200,
        actualProteinG: 20,
        actualCarbsG: 15,
        actualFatG: 8,
        adherenceScore: 85,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(existingQuickAdd),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(existingDailyLog),
          },
        });
      });

      const result = await caller.meal.quickAdd({
        calories: 200,
        protein: 20,
        carbs: 15,
        fat: 8,
        mealName: 'Protein Bar',
        mealSlot: 'snack',
      });

      expect(result.duplicate).toBe(true);
      expect(result.trackedMeal.id).toBe('meal-existing-quick');
    });

    it('includes macros when provided', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const quickAddWithMacros = {
        id: 'meal-macros',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date(),
        mealSlot: 'snack',
        mealName: 'Protein Shake',
        portion: 1.0,
        kcal: 250,
        proteinG: 30,
        carbsG: 15,
        fatG: 5,
        fiberG: null,
        source: 'quick_add',
        confidenceScore: 1.0,
        createdAt: new Date(),
      };

      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        isActive: true,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        createdAt: new Date(),
      };

      const dailyLog = {
        id: 'log-macros',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 250,
        actualProteinG: 30,
        actualCarbsG: 15,
        actualFatG: 5,
        adherenceScore: 85,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // @ts-expect-error - Mock transaction client
        return callback({
          trackedMeal: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(quickAddWithMacros),
          },
          userProfile: {
            findFirst: vi.fn().mockResolvedValue(mockProfile),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(dailyLog),
            update: vi.fn().mockResolvedValue(dailyLog),
          },
        });
      });

      const result = await caller.meal.quickAdd({
        calories: 250,
        protein: 30,
        carbs: 15,
        fat: 5,
        mealName: 'Protein Shake',
        mealSlot: 'snack',
      });

      expect(result.trackedMeal.proteinG).toBe(30);
      expect(result.trackedMeal.carbsG).toBe(15);
      expect(result.trackedMeal.fatG).toBe(5);
    });

    it('validates calories are within range', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      await expect(caller.meal.quickAdd({ calories: 0 })).rejects.toThrow();

      await expect(caller.meal.quickAdd({ calories: 15000 })).rejects.toThrow();
    });
  });

  describe('deleteTrackedMeal', () => {
    it('throws NOT_FOUND when meal does not exist', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.trackedMeal.findFirst).mockResolvedValue(null);

      await expect(
        caller.meal.deleteTrackedMeal({ trackedMealId: 'non-existent' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Tracked meal not found.',
      });
    });

    it('deletes meal and recalculates daily log', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mealToDelete = {
        id: 'meal-delete',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date('2026-02-05'),
        mealSlot: 'breakfast',
        mealName: 'Toast',
        portion: 1.0,
        kcal: 200,
        proteinG: 8,
        carbsG: 30,
        fatG: 4,
        fiberG: null,
        source: 'manual',
        confidenceScore: 1.0,
        createdAt: new Date(),
      };

      const updatedDailyLog = {
        id: 'log-123',
        userId: 'user-123',
        date: new Date('2026-02-05'),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 500,
        actualProteinG: 40,
        actualCarbsG: 50,
        actualFatG: 15,
        adherenceScore: 85,
      };

      vi.mocked(prisma.trackedMeal.findFirst).mockResolvedValue(mealToDelete);
      vi.mocked(prisma.trackedMeal.delete).mockResolvedValue(mealToDelete);
      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(updatedDailyLog);
      vi.mocked(prisma.dailyLog.update).mockResolvedValue(updatedDailyLog);

      const { recalculateDailyLog } = await import('@/server/utils/daily-log');

      const result = await caller.meal.deleteTrackedMeal({
        trackedMealId: 'meal-delete',
      });

      expect(result.deleted).toBe(true);
      expect(result.deletedMealName).toBe('Toast');
      expect(result.dailyLog?.actualKcal).toBe(500);
      expect(recalculateDailyLog).toHaveBeenCalled();
    });
  });

  describe('getTodaysLog', () => {
    it('returns null dailyLog when no data exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-no-log' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue([]);

      const result = await caller.meal.getTodaysLog();

      expect(result.dailyLog).toBeNull();
      expect(result.entries).toEqual([]);
    });

    it('returns todays log with all entries', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const todayLog = {
        id: 'log-today',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 1500,
        actualProteinG: 120,
        actualCarbsG: 150,
        actualFatG: 50,
        adherenceScore: 90,
      };

      const todayMeals = [
        {
          id: 'meal-1',
          userId: 'user-123',
          mealPlanId: null,
          loggedDate: new Date(),
          mealSlot: 'breakfast',
          mealName: 'Eggs',
          portion: 1.0,
          kcal: 300,
          proteinG: 20,
          carbsG: 5,
          fatG: 20,
          fiberG: null,
          source: 'manual' as const,
          confidenceScore: 1.0,
          createdAt: new Date(),
        },
        {
          id: 'meal-2',
          userId: 'user-123',
          mealPlanId: 'plan-123',
          loggedDate: new Date(),
          mealSlot: 'lunch',
          mealName: 'Salad',
          portion: 1.0,
          kcal: 400,
          proteinG: 30,
          carbsG: 40,
          fatG: 10,
          fiberG: null,
          source: 'plan_meal' as const,
          confidenceScore: 0.95,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(todayLog);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue(todayMeals);

      const result = await caller.meal.getTodaysLog();

      expect(result.dailyLog).toBeTruthy();
      expect(result.dailyLog?.actualKcal).toBe(1500);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].mealName).toBe('Eggs');
      expect(result.entries[1].source).toBe('plan_meal');
    });
  });
});
