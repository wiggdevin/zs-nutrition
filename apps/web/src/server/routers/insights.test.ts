import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext } from '@/test/trpc-test-utils';

// ---------------------------------------------------------------------------
// Mock dependencies that the insights router relies on
// ---------------------------------------------------------------------------

vi.mock('@/server/services/insights-aggregator', () => ({
  aggregateInsightsData: vi.fn(),
}));

vi.mock('@/server/services/insights-generator', () => ({
  generateInsights: vi.fn(),
  generateFallbackInsights: vi.fn(),
}));

vi.mock('@/server/utils/insights-logger', () => ({
  insightsLogger: {
    cacheHit: vi.fn(),
    cacheMiss: vi.fn(),
    pipelineComplete: vi.fn(),
    rateLimitExceeded: vi.fn(),
  },
  categorizeError: vi.fn().mockReturnValue('DATABASE_ERROR'),
  InsightsErrorCategory: {
    CLAUDE_AUTH_ERROR: 'CLAUDE_AUTH_ERROR',
  },
}));

// Import mocked modules so we can configure per-test behavior
import { aggregateInsightsData } from '@/server/services/insights-aggregator';
import { generateInsights, generateFallbackInsights } from '@/server/services/insights-generator';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'test-user-insights-123';

const mockPayload = {
  goalType: 'cut',
  goalRate: 1,
  dailyKcalTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 200,
  fatTargetG: 65,
  daysTracked: 14,
  avgAdherence: 75,
  avgCalorieDeficit: -100,
  avgProteinGap: -32,
  avgCarbsGap: -10,
  avgFatGap: -5,
  daysWithLowAdherence: 2,
  streakDays: 5,
  bestDay: 'Monday',
  worstDay: 'Saturday',
  totalMeals: 42,
  planMealPct: 60,
  totalSwaps: 3,
  frequentlySwappedSlots: ['dinner'],
  isPlateau: false,
  weightTrendLbsPerWeek: -0.8,
  weightEntryCount: 4,
  avgSleepScore: 78,
  avgReadinessScore: 72,
  daysWithPoorSleep: 2,
};

const mockHash = 'abc123def456789012345678901234567890123456789012345678901234abcd';

const mockInsights = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    category: 'macro_deficiency' as const,
    title: 'Protein intake below target',
    body: 'You averaged 32g below your daily protein target over the past 14 days.',
    supportingData: { metric: 'Protein', actual: '118g', target: '150g', trend: '-32g/day' },
    severity: 'action' as const,
    ctaType: 'adjust_macros' as const,
    ctaLabel: 'Adjust Macros',
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    category: 'positive_streak' as const,
    title: '5-day tracking streak',
    body: 'Consistency is the foundation of progress -- keep going!',
    supportingData: { metric: 'Streak', actual: '5 days', target: '7 days', trend: 'Consistent' },
    severity: 'info' as const,
    ctaType: 'view_trends' as const,
    ctaLabel: 'View Trends',
  },
];

// ---------------------------------------------------------------------------
// Helper to configure the default happy-path mock behavior
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  vi.mocked(aggregateInsightsData).mockResolvedValue({
    payload: mockPayload as any,
    inputHash: mockHash,
  });

  vi.mocked(generateInsights).mockResolvedValue({
    insights: mockInsights as any,
    tokenUsage: { inputTokens: 1850, outputTokens: 420 },
  });

  vi.mocked(generateFallbackInsights).mockReturnValue(mockInsights as any);

  // No cached record by default
  vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.aiInsight.create).mockResolvedValue({} as any);
  vi.mocked(prisma.aiInsight.count).mockResolvedValue(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insights router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // =========================================================================
  // getInsights
  // =========================================================================

  describe('getInsights', () => {
    it('returns cached insights when a valid cache record exists', async () => {
      const cachedRecord = {
        id: 'insight-cached-1',
        userId: TEST_USER_ID,
        insights: mockInsights,
        inputHash: mockHash,
        tokenUsage: { inputTokens: 1850, outputTokens: 420 },
        generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
      };

      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(cachedRecord as any);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(result.fromCache).toBe(true);
      expect(result.insights).toEqual(mockInsights);
      // Should NOT call generateInsights when cache hit
      expect(generateInsights).not.toHaveBeenCalled();
    });

    it('generates fresh insights on cache miss', async () => {
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(result.fromCache).toBe(false);
      expect(generateInsights).toHaveBeenCalledWith(mockPayload);
      expect(result.insights).toEqual(mockInsights);
    });

    it('returns insufficientData: true when daysTracked < 3', async () => {
      vi.mocked(aggregateInsightsData).mockResolvedValue({
        payload: { ...mockPayload, daysTracked: 2 } as any,
        inputHash: mockHash,
      });

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(result.insufficientData).toBe(true);
      expect(result.insights).toEqual([]);
      expect(result.daysTracked).toBe(2);
      expect(generateInsights).not.toHaveBeenCalled();
    });

    it('stores generated insights in the database', async () => {
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      await caller.insights.getInsights();

      expect(prisma.aiInsight.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(prisma.aiInsight.create).mock.calls[0][0];
      expect(createCall.data.userId).toBe(TEST_USER_ID);
      expect(createCall.data.inputHash).toBe(mockHash);
      expect(createCall.data.insights).toEqual(mockInsights);
    });

    it('returns fromCache: true for cache hit and fromCache: false for cache miss', async () => {
      // Cache miss first
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);
      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const missResult = await caller.insights.getInsights();
      expect(missResult.fromCache).toBe(false);

      // Cache hit
      vi.clearAllMocks();
      setupDefaultMocks();
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue({
        id: 'cached-id',
        userId: TEST_USER_ID,
        insights: mockInsights,
        inputHash: mockHash,
        tokenUsage: { inputTokens: 1850, outputTokens: 420 },
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any);

      const ctx2 = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller2 = createCaller(ctx2);
      const hitResult = await caller2.insights.getInsights();
      expect(hitResult.fromCache).toBe(true);
    });

    it('returns fallback insights when generateInsights throws', async () => {
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);
      vi.mocked(generateInsights).mockRejectedValue(new Error('Claude is down'));

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(generateFallbackInsights).toHaveBeenCalledWith(mockPayload);
      // The result still succeeds (graceful degradation)
      expect(result.fromCache).toBe(false);
      expect(result.insights).toEqual(mockInsights); // fallback mock returns mockInsights
    });

    it('returns empty insights array on total pipeline failure', async () => {
      vi.mocked(aggregateInsightsData).mockRejectedValue(new Error('DB connection lost'));

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(result.insights).toEqual([]);
      expect(result.fromCache).toBe(false);
    });
  });

  // =========================================================================
  // refreshInsights
  // =========================================================================

  describe('refreshInsights', () => {
    it('force-regenerates insights without checking cache', async () => {
      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.refreshInsights();

      // findFirst should NOT be called (skip cache lookup)
      expect(prisma.aiInsight.findFirst).not.toHaveBeenCalled();
      // But generateInsights SHOULD be called
      expect(generateInsights).toHaveBeenCalledWith(mockPayload);
      expect(result.fromCache).toBe(false);
      expect(result.insights).toEqual(mockInsights);
    });

    it('rate-limits at 3 refreshes per day', async () => {
      vi.mocked(prisma.aiInsight.count).mockResolvedValue(3);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);

      await expect(caller.insights.refreshInsights()).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });

      // Should not proceed to generate insights
      expect(generateInsights).not.toHaveBeenCalled();
    });

    it('stores token usage in the database create call', async () => {
      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      await caller.insights.refreshInsights();

      expect(prisma.aiInsight.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(prisma.aiInsight.create).mock.calls[0][0];
      expect(createCall.data.tokenUsage).toEqual({
        inputTokens: 1850,
        outputTokens: 420,
      });
    });

    it('returns insufficientData when daysTracked < 3', async () => {
      vi.mocked(aggregateInsightsData).mockResolvedValue({
        payload: { ...mockPayload, daysTracked: 1 } as any,
        inputHash: mockHash,
      });

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.refreshInsights();

      expect(result.insufficientData).toBe(true);
      expect(result.insights).toEqual([]);
      expect(result.daysTracked).toBe(1);
      expect(generateInsights).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Auth
  // =========================================================================

  describe('authentication', () => {
    it('getInsights is accessible by authenticated users', async () => {
      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);

      // Should not throw an auth error
      const result = await caller.insights.getInsights();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('insights');
    });

    it('refreshInsights is accessible by authenticated users', async () => {
      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);

      // Should not throw an auth error
      const result = await caller.insights.refreshInsights();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('insights');
    });
  });

  // =========================================================================
  // Response shape and cache TTL
  // =========================================================================

  describe('response shape and caching', () => {
    it('getInsights returns a valid InsightsResponse shape', async () => {
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      const result = await caller.insights.getInsights();

      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('fromCache');
      expect(Array.isArray(result.insights)).toBe(true);
      expect(typeof result.generatedAt).toBe('string');
      expect(typeof result.fromCache).toBe('boolean');
    });

    it('sets cache expiry to approximately 24 hours from generation', async () => {
      vi.mocked(prisma.aiInsight.findFirst).mockResolvedValue(null);

      const ctx = createAuthedTestContext({ dbUserId: TEST_USER_ID });
      const caller = createCaller(ctx);
      await caller.insights.getInsights();

      expect(prisma.aiInsight.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(prisma.aiInsight.create).mock.calls[0][0];
      const generatedAt = createCall.data.generatedAt as Date;
      const expiresAt = createCall.data.expiresAt as Date;

      const diffMs = expiresAt.getTime() - generatedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Should be exactly 24 hours (within a small tolerance for test execution time)
      expect(diffHours).toBeCloseTo(24, 0);
    });
  });
});
