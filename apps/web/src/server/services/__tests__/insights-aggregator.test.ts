import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { aggregateInsightsData } from '../insights-aggregator';
import {
  createMockDailyLogs,
  createMockTrackedMeals,
  createMockWeightEntries,
  createMockMealSwaps,
  createMockActivitySyncs,
  createMockUserProfile,
} from '@/test/fixtures/insights-mock-data';
import type {
  MockDailyLog,
  MockWeightEntry,
  MockActivitySync,
} from '@/test/fixtures/insights-mock-data';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/server/utils/weight-trend', () => ({
  calculateWeightTrend: vi.fn(),
  fetchChronologicalWeightEntries: vi.fn(),
}));

// Suppress logger output during tests
vi.mock('@/server/utils/insights-logger', () => ({
  insightsLogger: {
    aggregationStarted: vi.fn(),
    aggregationComplete: vi.fn(),
  },
}));

import { calculateWeightTrend, fetchChronologicalWeightEntries } from '@/server/utils/weight-trend';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'test-user-id';

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

function setupMocks(overrides?: {
  dailyLogs?: MockDailyLog[];
  trackedMeals?: Array<{ source: string; mealSlot: string | null; loggedDate: Date }>;
  mealSwaps?: Array<{ slot: string; createdAt: Date }>;
  weightEntries?: MockWeightEntry[];
  activitySyncs?: MockActivitySync[];
  userProfile?: Record<string, unknown> | null;
}) {
  vi.mocked(prisma.dailyLog.findMany).mockResolvedValue((overrides?.dailyLogs ?? []) as any);
  vi.mocked(prisma.trackedMeal.findMany).mockResolvedValue((overrides?.trackedMeals ?? []) as any);
  vi.mocked(prisma.mealSwap.findMany).mockResolvedValue((overrides?.mealSwaps ?? []) as any);
  vi.mocked(fetchChronologicalWeightEntries).mockResolvedValue(overrides?.weightEntries ?? []);
  vi.mocked(prisma.calorieAdjustment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.activitySync.findMany).mockResolvedValue(
    (overrides?.activitySyncs ?? []) as any
  );
  const profileValue =
    overrides && 'userProfile' in overrides ? overrides.userProfile : createMockUserProfile();
  vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(profileValue as any);
  vi.mocked(calculateWeightTrend).mockReturnValue(null);
}

// ---------------------------------------------------------------------------
// Helper to create deterministic daily logs (no random jitter)
// ---------------------------------------------------------------------------

function deterministicLogs(
  count: number,
  adherenceScore: number,
  overrides?: Partial<
    Pick<
      MockDailyLog,
      | 'targetKcal'
      | 'targetProteinG'
      | 'targetCarbsG'
      | 'targetFatG'
      | 'actualKcal'
      | 'actualProteinG'
      | 'actualCarbsG'
      | 'actualFatG'
    >
  >
): MockDailyLog[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (count - 1 - i));
    return {
      id: `log-${i}`,
      userId: TEST_USER_ID,
      date,
      targetKcal: overrides?.targetKcal ?? 2000,
      targetProteinG: overrides?.targetProteinG ?? 150,
      targetCarbsG: overrides?.targetCarbsG ?? 200,
      targetFatG: overrides?.targetFatG ?? 65,
      actualKcal: overrides?.actualKcal ?? 1900,
      actualProteinG: overrides?.actualProteinG ?? 140,
      actualCarbsG: overrides?.actualCarbsG ?? 190,
      actualFatG: overrides?.actualFatG ?? 60,
      adherenceScore,
      createdAt: now,
      updatedAt: now,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateInsightsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Complete payload with all fields
  it('returns a complete payload with all fields for 14 days of full data', async () => {
    const logs = createMockDailyLogs(14, [80, 90]);
    const meals = createMockTrackedMeals(14, { plan_meal: 0.7, manual: 0.3 });
    const weights = createMockWeightEntries(3, 180, -0.5);
    const swaps = createMockMealSwaps(4);
    const activity = createMockActivitySyncs(14, 'oura');
    const profile = createMockUserProfile();

    setupMocks({
      dailyLogs: logs,
      trackedMeals: meals.map((m) => ({
        source: m.source,
        mealSlot: m.mealSlot,
        loggedDate: m.loggedDate,
      })),
      mealSwaps: swaps.map((s) => ({ slot: s.slot, createdAt: s.createdAt })),
      weightEntries: weights,
      activitySyncs: activity,
      userProfile: profile as any,
    });

    const { payload, inputHash } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    // Verify all payload fields are present and have correct types
    expect(payload.goalType).toBe('cut');
    expect(payload.goalRate).toBe(1.0);
    expect(payload.dailyKcalTarget).toBe(2000);
    expect(payload.proteinTargetG).toBe(150);
    expect(payload.carbsTargetG).toBe(200);
    expect(payload.fatTargetG).toBe(65);
    expect(payload.daysTracked).toBe(14);
    expect(typeof payload.avgAdherence).toBe('number');
    expect(typeof payload.avgCalorieDeficit).toBe('number');
    expect(typeof payload.avgProteinGap).toBe('number');
    expect(typeof payload.avgCarbsGap).toBe('number');
    expect(typeof payload.avgFatGap).toBe('number');
    expect(typeof payload.daysWithLowAdherence).toBe('number');
    expect(typeof payload.streakDays).toBe('number');
    expect(typeof payload.totalMeals).toBe('number');
    expect(typeof payload.planMealPct).toBe('number');
    expect(typeof payload.totalSwaps).toBe('number');
    expect(Array.isArray(payload.frequentlySwappedSlots)).toBe(true);
    expect(typeof payload.isPlateau).toBe('boolean');
    expect(typeof payload.weightEntryCount).toBe('number');
    expect(typeof payload.avgSleepScore).toBe('number');
    expect(typeof payload.avgReadinessScore).toBe('number');
    expect(typeof payload.daysWithPoorSleep).toBe('number');
    expect(typeof inputHash).toBe('string');
    expect(inputHash).toHaveLength(64); // SHA-256 hex digest
  });

  // 2. Brand new user - all mocks return empty
  it('returns daysTracked === 0 for a brand new user with no data', async () => {
    setupMocks({
      userProfile: null,
    });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.daysTracked).toBe(0);
    expect(payload.avgAdherence).toBe(0);
    expect(payload.avgCalorieDeficit).toBe(0);
    expect(payload.avgProteinGap).toBe(0);
    expect(payload.totalMeals).toBe(0);
    expect(payload.totalSwaps).toBe(0);
    expect(payload.streakDays).toBe(0);
    expect(payload.bestDay).toBeNull();
    expect(payload.worstDay).toBeNull();
    expect(payload.avgSleepScore).toBeNull();
    expect(payload.avgReadinessScore).toBeNull();
    // Default values when no profile
    expect(payload.goalType).toBe('maintain');
    expect(payload.dailyKcalTarget).toBe(2000);
  });

  // 3. Partial data (3 of 14 days)
  it('handles partial data (3 of 14 days) and computes valid averages', async () => {
    const logs = deterministicLogs(3, 85);
    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.daysTracked).toBe(3);
    expect(payload.avgAdherence).toBe(85);
    expect(payload.avgCalorieDeficit).toBe(-100); // 1900 - 2000
    expect(payload.avgProteinGap).toBe(-10); // 140 - 150
  });

  // 4. Average adherence calculation
  it('correctly computes avgAdherence as the average of adherenceScore values', async () => {
    const logs: MockDailyLog[] = [
      { ...deterministicLogs(1, 90)[0], id: 'a' },
      { ...deterministicLogs(1, 70)[0], id: 'b' },
      { ...deterministicLogs(1, 50)[0], id: 'c' },
    ];

    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    // (90 + 70 + 50) / 3 = 70
    expect(payload.avgAdherence).toBe(70);
  });

  // 5. Protein gap calculation
  it('correctly computes avgProteinGap (actual minus target average)', async () => {
    // Protein: actual=120, target=150 => gap = -30
    const logs = deterministicLogs(5, 80, {
      actualProteinG: 120,
      targetProteinG: 150,
    });
    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.avgProteinGap).toBe(-30);
  });

  // 6. Days with low adherence count
  it('counts daysWithLowAdherence (< 60) correctly', async () => {
    const logs: MockDailyLog[] = [
      ...deterministicLogs(2, 55), // 2 days below 60
      ...deterministicLogs(3, 80), // 3 days at/above 60
    ];
    // Assign unique IDs to avoid potential issues
    logs.forEach((l, i) => {
      l.id = `log-low-${i}`;
    });

    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.daysWithLowAdherence).toBe(2);
  });

  // 7. Streak computation (consecutive >= 70 from most recent)
  it('computes streak correctly from the most recent day', async () => {
    // Logs are ordered desc in the query, so index 0 is most recent.
    // Streak of 3: the first 3 (most recent) have adherence >= 70, then a break.
    const logs: MockDailyLog[] = [
      // Most recent first (desc order)
      { ...deterministicLogs(1, 85)[0], id: 's-0' },
      { ...deterministicLogs(1, 72)[0], id: 's-1' },
      { ...deterministicLogs(1, 90)[0], id: 's-2' },
      { ...deterministicLogs(1, 50)[0], id: 's-3' }, // breaks streak
      { ...deterministicLogs(1, 95)[0], id: 's-4' },
    ];

    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.streakDays).toBe(3);
  });

  // 8. Best day and worst day identification
  it('identifies bestDay and worstDay correctly', async () => {
    // Create logs on known days of the week with distinct adherence.
    // Use fixed UTC dates so getUTCDay() is predictable.
    const monday = new Date('2026-02-16T00:00:00Z'); // Monday = getUTCDay() 1
    const friday = new Date('2026-02-20T00:00:00Z'); // Friday = getUTCDay() 5

    const logs: MockDailyLog[] = [
      {
        ...deterministicLogs(1, 95)[0],
        id: 'best',
        date: monday,
        adherenceScore: 95,
      },
      {
        ...deterministicLogs(1, 40)[0],
        id: 'worst',
        date: friday,
        adherenceScore: 40,
      },
    ];

    setupMocks({ dailyLogs: logs });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.bestDay).toBe('Monday');
    expect(payload.worstDay).toBe('Friday');
  });

  // 9. planMealPct calculation
  it('computes planMealPct correctly', async () => {
    // 6 out of 10 meals are from the plan => 60%
    const trackedMeals = Array.from({ length: 10 }, (_, i) => ({
      source: i < 6 ? 'plan_meal' : 'manual',
      mealSlot: 'lunch',
      loggedDate: new Date(),
    }));

    setupMocks({ trackedMeals });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.planMealPct).toBe(60);
    expect(payload.totalMeals).toBe(10);
  });

  // 10. Frequently swapped slots detection
  it('detects frequentlySwappedSlots for slots with 3+ swaps', async () => {
    // 4 breakfast swaps, 2 lunch swaps, 3 dinner swaps
    const swaps = [
      { slot: 'breakfast', createdAt: new Date() },
      { slot: 'breakfast', createdAt: new Date() },
      { slot: 'breakfast', createdAt: new Date() },
      { slot: 'breakfast', createdAt: new Date() },
      { slot: 'lunch', createdAt: new Date() },
      { slot: 'lunch', createdAt: new Date() },
      { slot: 'dinner', createdAt: new Date() },
      { slot: 'dinner', createdAt: new Date() },
      { slot: 'dinner', createdAt: new Date() },
    ];

    setupMocks({ mealSwaps: swaps });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.frequentlySwappedSlots).toContain('breakfast');
    expect(payload.frequentlySwappedSlots).toContain('dinner');
    expect(payload.frequentlySwappedSlots).not.toContain('lunch');
    expect(payload.totalSwaps).toBe(9);
  });

  // 11. Weight plateau detection
  it('detects weight plateau when conditions are met', async () => {
    const profile = createMockUserProfile({ goalType: 'cut' });

    setupMocks({
      dailyLogs: deterministicLogs(14, 80),
      userProfile: profile as any,
    });

    // Simulate a plateau: < 0.3 lbs/week change over 14+ days
    vi.mocked(calculateWeightTrend).mockReturnValue({
      weightChangeKg: 0.05,
      weightChangeLbs: 0.1,
      weeklyRateKg: 0.02,
      weeklyRateLbs: 0.05,
      timeSpanDays: 21,
    });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.isPlateau).toBe(true);
    expect(payload.weightTrendLbsPerWeek).toBe(0.05);
  });

  // 12. No plateau when goal is 'maintain'
  it('does NOT detect plateau when goal is maintain even if weight is flat', async () => {
    const profile = createMockUserProfile({ goalType: 'maintain' });

    setupMocks({
      dailyLogs: deterministicLogs(14, 80),
      userProfile: profile as any,
    });

    vi.mocked(calculateWeightTrend).mockReturnValue({
      weightChangeKg: 0.01,
      weightChangeLbs: 0.02,
      weeklyRateKg: 0.01,
      weeklyRateLbs: 0.01,
      timeSpanDays: 28,
    });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.isPlateau).toBe(false);
  });

  // 13. Missing activity data
  it('handles missing activity data with null sleep and readiness scores', async () => {
    setupMocks({
      dailyLogs: deterministicLogs(3, 80),
      activitySyncs: [],
    });

    const { payload } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(payload.avgSleepScore).toBeNull();
    expect(payload.avgReadinessScore).toBeNull();
    expect(payload.daysWithPoorSleep).toBe(0);
  });

  // 14. Input hash changes when data changes
  it('produces a different input hash when data changes', async () => {
    const logs3 = deterministicLogs(3, 80);
    setupMocks({ dailyLogs: logs3 });
    const { inputHash: hash1 } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    vi.clearAllMocks();

    const logs5 = deterministicLogs(5, 90);
    setupMocks({ dailyLogs: logs5 });
    const { inputHash: hash2 } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(hash1).not.toBe(hash2);
  });

  // 15. Input hash is stable for identical data
  it('produces a stable input hash when called twice with the same data', async () => {
    // Use deterministic logs so both calls produce identical payloads
    const logs = deterministicLogs(7, 80);
    const profile = createMockUserProfile();

    setupMocks({
      dailyLogs: logs,
      userProfile: profile as any,
    });
    const { inputHash: hash1 } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    // Reset and set up exactly the same data again
    vi.clearAllMocks();
    setupMocks({
      dailyLogs: logs,
      userProfile: profile as any,
    });
    const { inputHash: hash2 } = await aggregateInsightsData(prisma as any, TEST_USER_ID);

    expect(hash1).toBe(hash2);
  });
});
