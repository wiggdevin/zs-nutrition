import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext, testUUID } from '@/test/trpc-test-utils';

vi.mock('@/lib/queue', () => ({
  planGenerationQueue: {
    add: vi.fn(),
  },
}));

describe('plan router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivePlan', () => {
    it('returns null when no active plan exists', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(null);

      const result = await caller.plan.getActivePlan();

      expect(result).toBeNull();
      expect(prisma.mealPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            isActive: true,
            status: 'active',
            deletedAt: null,
          }),
        })
      );
    });

    it('returns the active plan with parsed JSON', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: testUUID('plan'),
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        trainingBonusKcal: 300,
        planDays: 7,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-08'),
        qaScore: 85,
        qaStatus: 'PASS' as const,
        status: 'active' as const,
        isActive: true,
        validatedPlan: {
          days: [
            {
              dayNumber: 1,
              isTrainingDay: true,
              meals: [],
            },
          ],
        },
        metabolicProfile: {
          bmrKcal: 1800,
          tdeeKcal: 2500,
          goalKcal: 2000,
          proteinTargetG: 150,
          carbsTargetG: 200,
          fatTargetG: 65,
        },
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as never);

      const result = await caller.plan.getActivePlan();

      expect(result).toBeTruthy();
      expect(result?.dailyKcalTarget).toBe(2000);
      expect(result?.validatedPlan).toHaveProperty('days');
      expect(result?.validatedPlan.days).toHaveLength(1);
      expect(result?.metabolicProfile).toHaveProperty('bmrKcal', 1800);
    });

    it('handles invalid JSON by returning empty structures', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: testUUID('plan'),
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        trainingBonusKcal: 0,
        planDays: 7,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-08'),
        qaScore: 85,
        qaStatus: 'PASS' as const,
        status: 'active' as const,
        isActive: true,
        validatedPlan: { invalid: 'data' }, // Invalid structure
        metabolicProfile: { invalid: 'data' }, // Invalid structure
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as never);

      const result = await caller.plan.getActivePlan();

      expect(result).toBeTruthy();
      // SafeParse will fail validation and return fallback
      expect(result?.validatedPlan).toEqual({ days: [] });
      expect(result?.metabolicProfile).toEqual({});
    });
  });

  describe('getPlanById', () => {
    it('throws NOT_FOUND when plan does not exist', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(null);

      await expect(caller.plan.getPlanById({ planId: testUUID('plan') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Meal plan not found.',
      });
    });

    it('returns the plan when it belongs to the user', async () => {
      const userId = testUUID('user');
      const planId = testUUID('plan');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockPlan = {
        id: planId,
        userId,
        profileId: testUUID('profile'),
        dailyKcalTarget: 2200,
        dailyProteinG: 160,
        dailyCarbsG: 220,
        dailyFatG: 70,
        trainingBonusKcal: 400,
        planDays: 7,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-08'),
        qaScore: 90,
        qaStatus: 'PASS' as const,
        status: 'active' as const,
        isActive: true,
        generatedAt: new Date(),
        deletedAt: null,
        validatedPlan: { days: [] },
        metabolicProfile: {
          bmrKcal: 1900,
          tdeeKcal: 2600,
          goalKcal: 2200,
        },
      };

      vi.mocked(prisma.mealPlan.findFirst).mockResolvedValue(mockPlan as never);

      const result = await caller.plan.getPlanById({ planId });

      expect(result.id).toBe(planId);
      expect(result.dailyKcalTarget).toBe(2200);
    });
  });

  describe('completeJob', () => {
    it('throws NOT_FOUND when job does not exist', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      vi.mocked(prisma.planGenerationJob.findFirst).mockResolvedValue(null);

      await expect(
        caller.plan.completeJob({
          jobId: testUUID('job'),
          planResult: {
            validatedPlan: { days: [] },
            metabolicProfile: {
              bmrKcal: 1800,
              tdeeKcal: 2500,
              goalKcal: 2000,
              proteinTargetG: 150,
              carbsTargetG: 200,
              fatTargetG: 65,
            },
            dailyKcalTarget: 2000,
            dailyProteinG: 150,
            dailyCarbsG: 200,
            dailyFatG: 65,
            trainingBonusKcal: 0,
            planDays: 7,
            qaScore: 85,
            qaStatus: 'PASS',
          },
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Plan generation job not found.',
      });
    });

    it('throws PRECONDITION_FAILED when no active profile exists', async () => {
      const userId = testUUID('user');
      const jobId = testUUID('job');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockJob = {
        id: jobId,
        userId,
        status: 'processing' as const,
        intakeData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        currentAgent: null,
        progress: null,
        result: null,
        error: null,
      };

      vi.mocked(prisma.planGenerationJob.findFirst).mockResolvedValue(mockJob as never);
      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(null);

      await expect(
        caller.plan.completeJob({
          jobId,
          planResult: {
            validatedPlan: { days: [] },
            metabolicProfile: {
              bmrKcal: 1800,
              tdeeKcal: 2500,
              goalKcal: 2000,
              proteinTargetG: 150,
              carbsTargetG: 200,
              fatTargetG: 65,
            },
            dailyKcalTarget: 2000,
            dailyProteinG: 150,
            dailyCarbsG: 200,
            dailyFatG: 65,
            trainingBonusKcal: 0,
            planDays: 7,
            qaScore: 85,
            qaStatus: 'PASS',
          },
        })
      ).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: 'No active user profile found. Complete onboarding first.',
      });
    });

    it('creates a new meal plan and deactivates old ones', async () => {
      const userId = testUUID('user');
      const jobId = testUUID('job');
      const planId = testUUID('plan');
      const profileId = testUUID('profile');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockJob = {
        id: jobId,
        userId,
        status: 'processing' as const,
        intakeData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        currentAgent: null,
        progress: null,
        result: null,
        error: null,
      };

      const mockProfile = {
        id: profileId,
        userId,
        name: 'Test User',
        isActive: true,
        createdAt: new Date(),
      };

      const mockNewPlan = {
        id: planId,
        userId,
        profileId,
        dailyKcalTarget: 2000,
        dailyProteinG: 150,
        dailyCarbsG: 200,
        dailyFatG: 65,
        trainingBonusKcal: 0,
        planDays: 7,
        startDate: new Date(),
        endDate: new Date(),
        qaScore: 85,
        qaStatus: 'PASS' as const,
        status: 'active' as const,
        isActive: true,
        generatedAt: new Date(),
        deletedAt: null,
        validatedPlan: { days: [] },
        metabolicProfile: {},
      };

      vi.mocked(prisma.planGenerationJob.findFirst).mockResolvedValue(mockJob as never);
      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(mockProfile as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          mealPlan: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(mockNewPlan),
          },
        });
      });
      vi.mocked(prisma.planGenerationJob.update).mockResolvedValue({
        ...mockJob,
        status: 'completed',
        result: { planId },
        completedAt: new Date(),
      } as never);

      const result = await caller.plan.completeJob({
        jobId,
        planResult: {
          validatedPlan: { days: [] },
          metabolicProfile: {
            bmrKcal: 1800,
            tdeeKcal: 2500,
            goalKcal: 2000,
            proteinTargetG: 150,
            carbsTargetG: 200,
            fatTargetG: 65,
          },
          dailyKcalTarget: 2000,
          dailyProteinG: 150,
          dailyCarbsG: 200,
          dailyFatG: 65,
          trainingBonusKcal: 0,
          planDays: 7,
          qaScore: 85,
          qaStatus: 'PASS',
        },
      });

      expect(result.planId).toBe(planId);
      expect(result.status).toBe('active');
      expect(result.isActive).toBe(true);
    });
  });

  describe('generatePlan', () => {
    it('creates a job record and enqueues to BullMQ', async () => {
      const userId = testUUID('user');
      const jobId = testUUID('job');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockJob = {
        id: jobId,
        userId,
        status: 'pending' as const,
        intakeData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        currentAgent: null,
        progress: null,
        result: null,
        error: null,
      };

      vi.mocked(prisma.planGenerationJob.create).mockResolvedValue(mockJob as never);

      const { planGenerationQueue } = await import('@/lib/queue');

      const result = await caller.plan.generatePlan({
        name: 'John Doe',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        trainingDays: ['monday', 'wednesday', 'friday'],
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePreferences: [],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMaxMin: 45,
        macroStyle: 'balanced',
        planDurationDays: 7,
      });

      expect(result.jobId).toBe(jobId);
      expect(prisma.planGenerationJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            status: 'pending',
            intakeData: expect.objectContaining({
              name: 'John Doe',
              age: 30,
            }),
          }),
        })
      );
      expect(planGenerationQueue.add).toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    it('throws NOT_FOUND when job does not exist', async () => {
      const userId = testUUID('user');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      vi.mocked(prisma.planGenerationJob.findFirst).mockResolvedValue(null);

      await expect(caller.plan.getJobStatus({ jobId: testUUID('job') })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Job not found.',
      });
    });

    it('returns job status with progress data', async () => {
      const userId = testUUID('user');
      const jobId = testUUID('job');
      const ctx = createAuthedTestContext({ dbUserId: userId });
      const caller = createCaller(ctx);

      const mockJob = {
        id: jobId,
        userId,
        status: 'processing' as const,
        intakeData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        currentAgent: 2,
        progress: {
          completedAgents: ['intake'],
          currentAgent: 2,
        },
        result: null,
        error: null,
      };

      vi.mocked(prisma.planGenerationJob.findFirst).mockResolvedValue(mockJob as never);

      const result = await caller.plan.getJobStatus({ jobId });

      expect(result.status).toBe('processing');
      expect(result.currentAgent).toBe(2);
      expect(result.currentAgentName).toBe('metabolic');
      expect(result.progress).toHaveProperty('completedAgents');
    });
  });
});
