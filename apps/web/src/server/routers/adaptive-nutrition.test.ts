import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext, testUUID } from '@/test/trpc-test-utils';

vi.mock('@/lib/queue', () => ({
  planGenerationQueue: {
    add: vi.fn(),
  },
}));

vi.mock('@/lib/metabolic-utils', () => ({
  MACRO_SPLITS: {
    balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
    high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
    low_carb: { protein: 0.35, carbs: 0.25, fat: 0.4 },
    keto: { protein: 0.3, carbs: 0.1, fat: 0.6 },
  },
  calculateMacroTargets: vi.fn(() => ({
    proteinG: 150,
    carbsG: 200,
    fatG: 65,
  })),
}));

vi.mock('@/server/utils/weight-trend', () => ({
  calculateWeightTrend: vi.fn(() => ({
    weeklyRateLbs: -1.0,
    weightChangeLbs: -4.0,
    weightChangeKg: -1.8,
    weeklyRateKg: -0.45,
    timeSpanDays: 28,
  })),
}));

vi.mock('@/lib/safe-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('adaptiveNutrition router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyCalorieAdjustment', () => {
    it('sets planRegenerated to false when BullMQ enqueue fails', async () => {
      const userId = testUUID('user');
      const profileId = testUUID('profile');
      const jobId = testUUID('job');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockProfile = {
        id: profileId,
        userId,
        name: 'Test User',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        bodyFatPercent: null,
        goalType: 'cut',
        goalRate: 1,
        goalKcal: 2000,
        bmrKcal: 1800,
        tdeeKcal: 2500,
        activityLevel: 'moderately_active',
        trainingDays: ['monday', 'wednesday', 'friday'],
        trainingTime: 'morning',
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePrefs: [],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        isActive: true,
        createdAt: new Date(),
      };

      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(mockProfile as never);

      // Return some weight entries so trend calculation works
      vi.mocked(prisma.weightEntry.findMany).mockResolvedValue([
        { id: testUUID(), userId, weightKg: 81, logDate: new Date('2026-02-01') },
        { id: testUUID(), userId, weightKg: 80, logDate: new Date('2026-02-15') },
      ] as never);

      vi.mocked(prisma.userProfile.update).mockResolvedValue({
        ...mockProfile,
        goalKcal: 2100,
        proteinTargetG: 158,
        carbsTargetG: 210,
        fatTargetG: 70,
      } as never);

      // User has an active plan, so regeneration will be attempted
      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue({
        id: testUUID('plan'),
        userId,
        isActive: true,
        status: 'active',
        deletedAt: null,
      } as never);

      vi.mocked(prisma.planGenerationJob.create).mockResolvedValue({
        id: jobId,
        userId,
        status: 'pending',
        intakeData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        currentAgent: null,
        progress: null,
        result: null,
        error: null,
      } as never);

      // Make BullMQ enqueue fail
      const { planGenerationQueue } = await import('@/lib/queue');
      vi.mocked(planGenerationQueue.add).mockRejectedValue(new Error('Redis connection refused'));

      vi.mocked(prisma.calorieAdjustment.create).mockResolvedValue({
        id: testUUID(),
        userId,
        previousGoalKcal: 2000,
        newGoalKcal: 2100,
        adjustmentReason: {},
        weightChangeKg: null,
        weightChangeLbs: null,
        trendAnalysis: null,
        milestoneAchieved: null,
        planRegenerated: false,
        createdAt: new Date(),
      } as never);

      const result = await caller.adaptiveNutrition.applyCalorieAdjustment({
        newGoalKcal: 2100,
        confirmed: true,
      });

      // The key assertion: planRegenerated should be false when queue fails
      expect(result.planRegenerated).toBe(false);

      // Verify the audit log was created with planRegenerated = false
      expect(prisma.calorieAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planRegenerated: false,
          }),
        })
      );
    });
  });
});
