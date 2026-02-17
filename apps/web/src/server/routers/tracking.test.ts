import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext } from '@/test/trpc-test-utils';

describe('tracking router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDailySummary', () => {
    it('returns null dailyLog and empty trackedMeals when no data exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-no-data' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue([]);

      const result = await caller.tracking.getDailySummary();

      expect(result.dailyLog).toBeNull();
      expect(result.trackedMeals).toEqual([]);
      expect(result.mealCount).toBe(0);
      expect(result.totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    });

    it('returns dailyLog with tracked meals and calculated totals', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockDailyLog = {
        id: 'log-123',
        userId: 'user-123',
        date: new Date('2026-02-05'),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 1800,
        actualProteinG: 140,
        actualCarbsG: 180,
        actualFatG: 60,
        adherenceScore: 92,
      };

      const mockTrackedMeals = [
        {
          id: 'meal-1',
          userId: 'user-123',
          mealPlanId: null,
          loggedDate: new Date('2026-02-05'),
          mealSlot: 'breakfast',
          mealName: 'Oatmeal',
          portion: 1.0,
          kcal: 400,
          proteinG: 10.5,
          carbsG: 60.0,
          fatG: 8.0,
          fiberG: 5.0,
          source: 'manual',
          confidenceScore: 1.0,
          createdAt: new Date('2026-02-05T08:00:00'),
        },
        {
          id: 'meal-2',
          userId: 'user-123',
          mealPlanId: 'plan-123',
          loggedDate: new Date('2026-02-05'),
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
          createdAt: new Date('2026-02-05T12:30:00'),
        },
      ];

      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(mockDailyLog as any);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue(mockTrackedMeals as any);

      const result = await caller.tracking.getDailySummary({
        date: '2026-02-05',
      });

      expect(result.dailyLog).toBeTruthy();
      expect(result.dailyLog?.targetKcal).toBe(2000);
      expect(result.dailyLog?.actualKcal).toBe(1800);
      expect(result.trackedMeals).toHaveLength(2);
      expect(result.mealCount).toBe(2);
      expect(result.totals.kcal).toBe(1000); // 400 + 600
      expect(result.totals.proteinG).toBe(60.5); // 10.5 + 50.0, rounded to 1 decimal
    });

    it('defaults to today when no date is provided', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.dailyLog.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue([]);

      await caller.tracking.getDailySummary();

      expect(prisma.dailyLog.findUnique).toHaveBeenCalled();
      // Verify it was called with a date parameter
      const call = vi.mocked(prisma.dailyLog.findUnique).mock.calls[0][0];
      expect(call.where.userId_date!.userId).toBe('user-123');
      expect(call.where.userId_date!.date).toBeInstanceOf(Date);
    });
  });

  describe('getWeeklyTrend', () => {
    it('throws BAD_REQUEST when startDate is in the future', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      await expect(
        caller.tracking.getWeeklyTrend({
          startDate: futureDate.toISOString().split('T')[0],
        })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Start date cannot be in the future',
      });
    });

    it('returns 7 days of summary data', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const _startDate = new Date('2026-02-01');
      const mockDailyLogs = [
        {
          id: 'log-1',
          userId: 'user-123',
          date: new Date('2026-02-01'),
          targetKcal: 2000,
          targetProteinG: 150,
          targetCarbsG: 200,
          targetFatG: 65,
          actualKcal: 1950,
          actualProteinG: 145,
          actualCarbsG: 195,
          actualFatG: 63,
          adherenceScore: 95,
        },
        {
          id: 'log-2',
          userId: 'user-123',
          date: new Date('2026-02-02'),
          targetKcal: 2000,
          targetProteinG: 150,
          targetCarbsG: 200,
          targetFatG: 65,
          actualKcal: 2100,
          actualProteinG: 160,
          actualCarbsG: 210,
          actualFatG: 70,
          adherenceScore: 88,
        },
      ];

      vi.mocked(prisma.dailyLog.findMany).mockResolvedValue(mockDailyLogs as any);
      vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue([]);

      const result = await caller.tracking.getWeeklyTrend({
        startDate: '2026-02-01',
      });

      expect(result.days).toHaveLength(7);
      expect(result.totalDays).toBe(7);
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();

      // First two days should have targets (from dailyLogs)
      expect(result.days[0].targets).toBeTruthy();
      expect(result.days[1].targets).toBeTruthy();

      // Days without logs should have null targets
      expect(result.days[2].targets).toBeNull();
    });
  });

  describe('logMeal', () => {
    it('creates a tracked meal and updates daily log', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

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

      const mockTrackedMeal = {
        id: 'meal-new',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date(),
        mealSlot: 'lunch',
        mealName: 'Grilled Chicken',
        portion: 1.0,
        kcal: 500,
        proteinG: 45.0,
        carbsG: 10.0,
        fatG: 15.0,
        fiberG: null,
        source: 'manual',
        confidenceScore: 1.0,
        createdAt: new Date(),
      };

      const mockDailyLog = {
        id: 'log-new',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 500,
        actualProteinG: 45,
        actualCarbsG: 10,
        actualFatG: 15,
        adherenceScore: 0,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          trackedMeal: {
            create: vi.fn().mockResolvedValue(mockTrackedMeal),
          },
          userProfile: {
            findFirst: vi.fn().mockResolvedValue(mockProfile),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockDailyLog),
          },
        });
      });

      const result = await caller.tracking.logMeal({
        mealName: 'Grilled Chicken',
        calories: 500,
        protein: 45,
        carbs: 10,
        fat: 15,
        mealSlot: 'lunch',
      });

      expect(result.trackedMeal.mealName).toBe('Grilled Chicken');
      expect(result.trackedMeal.kcal).toBe(500);
      expect(result.dailyLog.actualKcal).toBe(500);
    });

    it('validates negative values are rejected', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      await expect(
        caller.tracking.logMeal({
          mealName: 'Test',
          calories: -100,
          protein: 20,
          carbs: 10,
          fat: 5,
        })
      ).rejects.toThrow();
    });

    it('validates meal name is required', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      await expect(
        caller.tracking.logMeal({
          mealName: '',
          calories: 100,
          protein: 20,
          carbs: 10,
          fat: 5,
        })
      ).rejects.toThrow();
    });

    it('rounds macros to correct precision', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

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

      const mockTrackedMeal = {
        id: 'meal-new',
        userId: 'user-123',
        mealPlanId: null,
        loggedDate: new Date(),
        mealSlot: null,
        mealName: 'Test Meal',
        portion: 1.0,
        kcal: 123, // Calories rounded to integer
        proteinG: 12.3, // Protein rounded to 1 decimal
        carbsG: 45.7, // Carbs rounded to 1 decimal
        fatG: 6.8, // Fat rounded to 1 decimal
        fiberG: null,
        source: 'manual',
        confidenceScore: 1.0,
        createdAt: new Date(),
      };

      const mockDailyLog = {
        id: 'log-new',
        userId: 'user-123',
        date: new Date(),
        targetKcal: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 65,
        actualKcal: 123,
        actualProteinG: 12,
        actualCarbsG: 46,
        actualFatG: 7,
        adherenceScore: 0,
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          trackedMeal: {
            create: vi.fn().mockResolvedValue(mockTrackedMeal),
          },
          userProfile: {
            findFirst: vi.fn().mockResolvedValue(mockProfile),
          },
          dailyLog: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockDailyLog),
          },
        });
      });

      const result = await caller.tracking.logMeal({
        mealName: 'Test Meal',
        calories: 123.456,
        protein: 12.345,
        carbs: 45.678,
        fat: 6.789,
      });

      expect(result.trackedMeal.kcal).toBe(123);
      expect(result.trackedMeal.proteinG).toBe(12.3);
      expect(result.trackedMeal.carbsG).toBe(45.7);
      expect(result.trackedMeal.fatG).toBe(6.8);
    });
  });
});
