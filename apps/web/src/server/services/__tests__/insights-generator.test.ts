import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InsightsDataPayload } from '@/lib/insights/schemas';

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK before importing the generator.
//
// The generator uses a lazy singleton: `let client: Anthropic | null = null`.
// To intercept the `messages.create` call we need the mock function reference
// that the constructor injects. We store it on the module export so the test
// can always reach the same reference the singleton holds.
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  // Use a class so `new Anthropic(...)` works properly (avoids vitest warning)
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: Record<string, unknown>) {
      // no-op
    }
  }
  return { default: MockAnthropic };
});

// Mock the logger to suppress console output during tests
vi.mock('@/server/utils/insights-logger', () => ({
  insightsLogger: {
    claudeRequest: vi.fn(),
    claudeResponse: vi.fn(),
    claudeFailed: vi.fn(),
    fallback: vi.fn(),
    validationFailed: vi.fn(),
  },
  categorizeError: vi.fn().mockReturnValue('DATABASE_ERROR'),
  InsightsErrorCategory: {
    CLAUDE_RATE_LIMIT: 'CLAUDE_RATE_LIMIT',
    CLAUDE_OVERLOADED: 'CLAUDE_OVERLOADED',
    CLAUDE_AUTH_ERROR: 'CLAUDE_AUTH_ERROR',
    CLAUDE_TIMEOUT: 'CLAUDE_TIMEOUT',
    DATABASE_ERROR: 'DATABASE_ERROR',
    RESPONSE_VALIDATION_FAILED: 'RESPONSE_VALIDATION_FAILED',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    RATE_LIMIT_USER: 'RATE_LIMIT_USER',
  },
}));

// Import the module under test AFTER mocks are declared
import { generateInsights, generateFallbackInsights, withRetry } from '../insights-generator';

// Import fixtures
import {
  VALID_3_RECOMMENDATIONS,
  VALID_2_RECOMMENDATIONS,
  TEXT_ONLY_NO_TOOL_USE,
  MALFORMED_TOOL_USE,
  EMPTY_RECOMMENDATIONS,
} from '@/test/fixtures/claude-response-fixtures';

// ---------------------------------------------------------------------------
// Shared test payload
// ---------------------------------------------------------------------------

const basePayload: InsightsDataPayload = {
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  vi.clearAllMocks();
});

// ===========================================================================
// generateInsights
// ===========================================================================

describe('generateInsights', () => {
  it('parses a valid 3-recommendation Claude tool_use response', async () => {
    mockCreate.mockResolvedValue(VALID_3_RECOMMENDATIONS);

    const { insights } = await generateInsights(basePayload);

    expect(insights).toHaveLength(3);
    expect(insights[0].category).toBe('macro_deficiency');
    expect(insights[1].category).toBe('low_adherence');
    expect(insights[2].category).toBe('positive_streak');
  });

  it('parses a valid 2-recommendation Claude tool_use response', async () => {
    mockCreate.mockResolvedValue(VALID_2_RECOMMENDATIONS);

    const { insights } = await generateInsights(basePayload);

    expect(insights).toHaveLength(2);
    expect(insights[0].category).toBe('weight_plateau');
    expect(insights[1].category).toBe('macro_deficiency');
  });

  it('returns token usage from the Claude response', async () => {
    mockCreate.mockResolvedValue(VALID_3_RECOMMENDATIONS);

    const { tokenUsage } = await generateInsights(basePayload);

    expect(tokenUsage.inputTokens).toBe(2100);
    expect(tokenUsage.outputTokens).toBe(580);
  });

  it('falls back to deterministic insights when Claude returns text-only (no tool_use block)', async () => {
    mockCreate.mockResolvedValue(TEXT_ONLY_NO_TOOL_USE);

    const { insights, tokenUsage } = await generateInsights(basePayload);

    // The "no tool_use block" error triggers the outer catch, yielding zero token usage
    expect(tokenUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
    // Fallback should produce 2-3 deterministic insights
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.length).toBeLessThanOrEqual(3);
  });

  it('falls back to deterministic insights when Claude returns malformed tool_use', async () => {
    mockCreate.mockResolvedValue(MALFORMED_TOOL_USE);

    const { insights } = await generateInsights(basePayload);

    // Malformed items fail Zod validation, triggering internal fallback
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.length).toBeLessThanOrEqual(3);
    // Each fallback insight should still be a valid InsightItem shape
    for (const insight of insights) {
      expect(insight).toHaveProperty('id');
      expect(insight).toHaveProperty('category');
      expect(insight).toHaveProperty('severity');
    }
  });

  it('falls back when Claude returns empty recommendations', async () => {
    mockCreate.mockResolvedValue(EMPTY_RECOMMENDATIONS);

    const { insights, tokenUsage } = await generateInsights(basePayload);

    // Empty recommendations throws "missing recommendations array", caught by outer catch
    expect(tokenUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(insights.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back with zero token usage when mockCreate throws a generic error', async () => {
    mockCreate.mockRejectedValue(new Error('Network failure'));

    const { insights, tokenUsage } = await generateInsights(basePayload);

    expect(tokenUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});

// ===========================================================================
// generateFallbackInsights
// ===========================================================================

describe('generateFallbackInsights', () => {
  it('generates macro_deficiency when avgProteinGap < -20', () => {
    const payload = { ...basePayload, avgProteinGap: -35, streakDays: 0, isPlateau: false };
    const insights = generateFallbackInsights(payload);

    const macroInsight = insights.find((i) => i.category === 'macro_deficiency');
    expect(macroInsight).toBeDefined();
    expect(macroInsight!.severity).toBe('action');
    expect(macroInsight!.ctaType).toBe('adjust_macros');
  });

  it('generates weight_plateau when isPlateau is true', () => {
    const payload = {
      ...basePayload,
      isPlateau: true,
      avgProteinGap: 0,
      streakDays: 0,
    };
    const insights = generateFallbackInsights(payload);

    const plateauInsight = insights.find((i) => i.category === 'weight_plateau');
    expect(plateauInsight).toBeDefined();
    expect(plateauInsight!.severity).toBe('warning');
    expect(plateauInsight!.ctaType).toBe('regenerate_plan');
  });

  it('generates positive_streak when streakDays >= 5', () => {
    const payload = {
      ...basePayload,
      streakDays: 7,
      avgProteinGap: 0,
      isPlateau: false,
    };
    const insights = generateFallbackInsights(payload);

    const streakInsight = insights.find((i) => i.category === 'positive_streak');
    expect(streakInsight).toBeDefined();
    expect(streakInsight!.severity).toBe('info');
    expect(streakInsight!.title).toContain('7-day');
  });

  it('pads to 2 insights when only 1 candidate matches', () => {
    // Only protein deficiency matches (avgProteinGap < -20), all other rules fail
    const payload: InsightsDataPayload = {
      ...basePayload,
      avgProteinGap: -25,
      avgCalorieDeficit: 0,
      isPlateau: false,
      daysWithLowAdherence: 0,
      streakDays: 2,
      planMealPct: 80,
      daysWithPoorSleep: 0,
      avgSleepScore: null,
    };

    const insights = generateFallbackInsights(payload);

    expect(insights.length).toBeGreaterThanOrEqual(2);
    // The padding insight is a generic "keep tracking" insight
    const padInsight = insights.find((i) => i.title === 'Keep tracking for better insights');
    expect(padInsight).toBeDefined();
  });

  it('returns at most 3 insights when many rules match', () => {
    // Trigger as many rules as possible
    const payload: InsightsDataPayload = {
      ...basePayload,
      avgProteinGap: -40, // Rule 1: macro_deficiency
      avgCalorieDeficit: 500, // Rule 2: overconsumption
      isPlateau: true, // Rule 3: weight_plateau
      daysWithLowAdherence: 5, // Rule 4: low_adherence
      streakDays: 7, // Rule 5: positive_streak
      planMealPct: 0.1, // Rule 6: unused_plan_meals (< 0.3)
      daysWithPoorSleep: 5, // Rule 7: recovery_impact
      avgSleepScore: 55,
    };

    const insights = generateFallbackInsights(payload);

    expect(insights).toHaveLength(3);
  });
});

// ===========================================================================
// withRetry
// ===========================================================================

describe('withRetry', () => {
  it('returns immediately when the function succeeds on first call', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after all attempts when the function always fails with a non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Something broke'));

    await expect(withRetry(fn)).rejects.toThrow('Something broke');
    // Non-retryable errors (categorized as DATABASE_ERROR by mock) are not retried
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
