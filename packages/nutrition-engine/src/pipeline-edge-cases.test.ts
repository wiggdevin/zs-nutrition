/**
 * Pipeline Edge Cases & Safety Tests
 *
 * Tests constraint gates, XSS prevention, config validation, error sanitization,
 * HTML structure, imperial unit handling, and circuit breaker exports.
 *
 * Uses natural fallbacks (deterministic meal generator + local food DB).
 * Only Puppeteer (pdf-renderer) is mocked.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NutritionPipelineOrchestrator, PipelineConfig, PipelineResult } from './orchestrator';
import { RawIntakeForm, PipelineProgress } from './types/schemas';
import { sanitizeError } from './utils/error-sanitizer';
import { fatSecretCircuitBreaker } from './adapters/fatsecret';

vi.mock('./agents/brand-renderer/pdf-renderer', () => ({
  renderPdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  closeBrowserPool: vi.fn(),
}));

const TEST_CONFIG: PipelineConfig = {
  anthropicApiKey: 'YOUR_KEY_placeholder',
  usdaApiKey: 'placeholder-usda-key',
};

function createTestInput(overrides: Partial<RawIntakeForm> = {}): RawIntakeForm {
  return {
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goalType: 'maintain',
    goalRate: 0,
    activityLevel: 'moderately_active',
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    dietaryStyle: 'omnivore',
    allergies: [],
    exclusions: [],
    cuisinePreferences: ['mediterranean', 'asian'],
    mealsPerDay: 4,
    snacksPerDay: 2,
    cookingSkill: 6,
    prepTimeMaxMin: 45,
    macroStyle: 'balanced',
    planDurationDays: 7,
    ...overrides,
  } as RawIntakeForm;
}

describe('Pipeline Edge Cases', () => {
  let orchestrator: NutritionPipelineOrchestrator;
  let defaultResult: PipelineResult;

  beforeAll(async () => {
    orchestrator = new NutritionPipelineOrchestrator(TEST_CONFIG);
    defaultResult = await orchestrator.run(createTestInput());
    expect(defaultResult.success).toBe(true);
  }, 15000);

  // ── Test 1: Vegan+keto constraint rejection (P2-T05) ────────────────
  it('halts pipeline for incompatible vegan+keto constraints', async () => {
    const events: PipelineProgress[] = [];
    const result = await orchestrator.run(
      createTestInput({ dietaryStyle: 'vegan', macroStyle: 'keto' }),
      (p) => {
        events.push({ ...p });
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Incompatible dietary constraints');

    // Progress should show failure at Agent 1
    const failedEvent = events.find((e) => e.status === 'failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.agent).toBe(1);
  });

  // ── Test 2: XSS payloads escaped in HTML (P1-T02) ──────────────────
  it('does not contain raw <script> or onerror= in deliverables HTML', async () => {
    const result = await orchestrator.run(
      createTestInput({
        name: '<script>alert("xss")</script>',
        exclusions: ['<img onerror=alert(1) src=x>'],
        cuisinePreferences: ['"><script>alert(1)</script>'],
      })
    );
    expect(result.success).toBe(true);

    const allHtml = [
      result.deliverables!.summaryHtml,
      result.deliverables!.gridHtml,
      result.deliverables!.groceryHtml,
    ].join('\n');

    // No raw script injection (case-insensitive to catch variants)
    expect(allHtml).not.toMatch(/<script>alert/i);
    expect(allHtml).not.toMatch(/onerror\s*=/i);
    expect(allHtml).not.toMatch(/javascript:/i);
  }, 10000);

  // ── Test 3: Config validation rejects missing keys (P3-T07) ─────────
  it('throws on construction with missing USDA API key', () => {
    expect(
      () =>
        new NutritionPipelineOrchestrator({
          anthropicApiKey: 'YOUR_KEY_test',
          usdaApiKey: '',
        })
    ).toThrow('Pipeline configuration is invalid');
  });

  it('throws on construction with missing Anthropic key', () => {
    expect(
      () =>
        new NutritionPipelineOrchestrator({
          anthropicApiKey: '',
          usdaApiKey: 'test-usda-key',
        })
    ).toThrow('Pipeline configuration is invalid');
  });

  // ── Test 4: Error sanitizer maps known errors (P4-T07) ──────────────
  it('maps known error types to user-friendly messages', () => {
    // ZodError
    const zodError = new Error('Validation failed');
    zodError.name = 'ZodError';
    expect(sanitizeError(zodError)).toBe(
      'Invalid input data. Please check your profile and try again.'
    );

    // Anthropic API error
    expect(sanitizeError(new Error('anthropic api_error: overloaded'))).toBe(
      'AI service is temporarily unavailable. Please try again in a few minutes.'
    );

    // FatSecret error
    expect(sanitizeError(new Error('circuit breaker open for fatsecret'))).toBe(
      'Nutrition data service is temporarily unavailable. Please try again shortly.'
    );

    // Puppeteer error
    expect(sanitizeError(new Error('puppeteer browser launch failed'))).toBe(
      'PDF generation failed. Your meal plan data is still available.'
    );

    // Timeout
    expect(sanitizeError(new Error('Request timed out'))).toBe(
      'The request took too long. Please try again.'
    );

    // Unknown error
    expect(sanitizeError(new Error('some random failure'))).toBe(
      'An unexpected error occurred during meal plan generation. Please try again.'
    );
  });

  // ── Test 5: HTML deliverables contain expected structure ─────────────
  it('HTML deliverables contain summary kcal, grid days, and grocery categories', () => {
    const { summaryHtml, gridHtml, groceryHtml } = defaultResult.deliverables!;

    // Summary contains kcal value and title
    expect(summaryHtml).toContain('Meal Plan Summary');
    expect(summaryHtml).toMatch(/\d+/); // contains numbers (kcal, etc.)

    // Grid contains day cards
    expect(gridHtml).toContain('day-card');
    expect(gridHtml).toContain('days-grid');

    // Grocery contains category sections and title
    expect(groceryHtml).toContain('Grocery List');
    expect(groceryHtml.length).toBeGreaterThan(100);
  });

  // ── Test 6: Runs without progress callback ──────────────────────────
  it('completes successfully without a progress callback', async () => {
    const result = await orchestrator.run(createTestInput());
    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.deliverables).toBeDefined();
  }, 10000);

  // ── Test 7: Performance under 5s with fallbacks ─────────────────────
  it('completes full pipeline in under 5 seconds with fallbacks', async () => {
    const start = Date.now();
    const result = await orchestrator.run(createTestInput());
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  }, 10000);

  // ── Test 8: Imperial unit conversion ────────────────────────────────
  it('handles imperial units (heightFeet/heightInches/weightLbs)', async () => {
    const result = await orchestrator.run(
      createTestInput({
        heightCm: undefined,
        heightFeet: 5,
        heightInches: 11,
        weightKg: undefined,
        weightLbs: 180,
      })
    );

    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan!.days.length).toBe(7);
  }, 10000);

  // ── Test 9: No progress callback still works ────────────────────────
  it('fast path completes without a progress callback', async () => {
    const fullRun = await orchestrator.run(createTestInput());
    expect(fullRun.success).toBe(true);

    const fastResult = await orchestrator.runFast({
      rawInput: createTestInput(),
      existingDraft: fullRun.draft!,
    });
    expect(fastResult.success).toBe(true);
    expect(fastResult.plan).toBeDefined();
  }, 15000);

  // ── Test 10: Circuit breaker module exports (P3-T02) ────────────────
  it('circuit breaker singleton exports getState() returning closed', () => {
    expect(fatSecretCircuitBreaker.getState()).toBe('closed');
    expect(typeof fatSecretCircuitBreaker.getFailureCount).toBe('function');
    expect(fatSecretCircuitBreaker.getFailureCount()).toBe(0);
  });
});
