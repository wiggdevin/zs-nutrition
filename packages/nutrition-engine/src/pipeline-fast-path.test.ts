/**
 * Pipeline Fast Path Tests
 *
 * Exercises NutritionPipelineOrchestrator.runFast() which skips Agent 3
 * (RecipeCurator), reusing an existing MealPlanDraft for recalculation.
 *
 * Uses natural fallbacks (deterministic meal generator + local food DB).
 * Only Puppeteer (pdf-renderer) is mocked.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  NutritionPipelineOrchestrator,
  PipelineConfig,
  PipelineResult,
  ProgressCallback,
} from './orchestrator';
import { RawIntakeForm, PipelineProgress, MealPlanValidatedSchema } from './types/schemas';

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

function createProgressTracker() {
  const events: PipelineProgress[] = [];
  const callback: ProgressCallback = (progress) => {
    events.push({ ...progress });
  };
  return { callback, events };
}

describe('Pipeline Fast Path', () => {
  let orchestrator: NutritionPipelineOrchestrator;
  let fullResult: PipelineResult;
  const input = createTestInput();

  beforeAll(async () => {
    orchestrator = new NutritionPipelineOrchestrator(TEST_CONFIG);
    fullResult = await orchestrator.run(input);
    expect(fullResult.success).toBe(true);
    expect(fullResult.draft).toBeDefined();
  }, 15000);

  // ── Test 1: Fast path produces valid output (P4-T04) ────────────────
  it('produces schema-valid plan from existing draft', async () => {
    const fastResult = await orchestrator.runFast({
      rawInput: input,
      existingDraft: fullResult.draft!,
    });

    expect(fastResult.success).toBe(true);
    expect(fastResult.plan).toBeDefined();
    expect(fastResult.deliverables).toBeDefined();

    // Schema validation
    MealPlanValidatedSchema.parse(fastResult.plan);

    // Deliverables present
    expect(fastResult.deliverables!.summaryHtml.length).toBeGreaterThan(0);
    expect(fastResult.deliverables!.gridHtml.length).toBeGreaterThan(0);
    expect(fastResult.deliverables!.groceryHtml.length).toBeGreaterThan(0);
    expect(Buffer.isBuffer(fastResult.deliverables!.pdfBuffer)).toBe(true);
  }, 10000);

  // ── Test 2: Progress events skip Agent 3 (P4-T04) ──────────────────
  it('emits progress for agents 1, 2, 4, 5, 6 but NOT Agent 3', async () => {
    const tracker = createProgressTracker();
    await orchestrator.runFast(
      { rawInput: input, existingDraft: fullResult.draft! },
      tracker.callback
    );

    const agentNumbers = tracker.events.map((e) => e.agent);
    expect(agentNumbers).toContain(1);
    expect(agentNumbers).toContain(2);
    expect(agentNumbers).not.toContain(3);
    expect(agentNumbers).toContain(4);
    expect(agentNumbers).toContain(5);
    expect(agentNumbers).toContain(6);
    expect(tracker.events[tracker.events.length - 1].status).toBe('completed');
  }, 10000);

  // ── Test 3: Changed goal still produces valid output ────────────────
  it('succeeds with modified input (cut goal) using existing draft', async () => {
    const modifiedInput = createTestInput({ goalType: 'cut', goalRate: 1 });
    const fastResult = await orchestrator.runFast({
      rawInput: modifiedInput,
      existingDraft: fullResult.draft!,
    });

    expect(fastResult.success).toBe(true);
    expect(fastResult.plan).toBeDefined();
    MealPlanValidatedSchema.parse(fastResult.plan);
  }, 10000);

  // ── Test 4: Constraint gate still works in fast path (P2-T05) ───────
  it('rejects vegan+keto even in fast path', async () => {
    const incompatibleInput = createTestInput({
      dietaryStyle: 'vegan',
      macroStyle: 'keto',
    });

    const tracker = createProgressTracker();
    const fastResult = await orchestrator.runFast(
      { rawInput: incompatibleInput, existingDraft: fullResult.draft! },
      tracker.callback
    );

    expect(fastResult.success).toBe(false);
    expect(fastResult.error).toContain('Incompatible dietary constraints');

    const failedEvent = tracker.events.find((e) => e.status === 'failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.agent).toBe(1);
  }, 10000);

  // ── Test 5: Returns original draft unchanged ────────────────────────
  it('returns the same draft reference passed in', async () => {
    const fastResult = await orchestrator.runFast({
      rawInput: input,
      existingDraft: fullResult.draft!,
    });

    expect(fastResult.success).toBe(true);
    expect(fastResult.draft).toBe(fullResult.draft);
  }, 10000);
});
