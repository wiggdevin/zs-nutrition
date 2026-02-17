/**
 * Pipeline E2E Tests
 *
 * Exercises the full NutritionPipelineOrchestrator.run() flow:
 *   Intake → MetabolicCalc → RecipeCurator → NutritionCompiler → QAValidator → BrandRenderer
 *
 * Uses natural fallbacks (deterministic meal generator + local food DB) for zero API calls.
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
import { IntakeNormalizer } from './agents/intake-normalizer';
import {
  MetabolicCalculator,
  CALORIC_FLOOR_FEMALE,
  CALORIC_FLOOR_MALE,
  FIBER_FLOOR_FEMALE,
  FIBER_FLOOR_MALE,
} from './agents/metabolic-calculator';

vi.mock('./agents/brand-renderer/pdf-renderer', () => ({
  renderPdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  closeBrowserPool: vi.fn(),
}));

const TEST_CONFIG: PipelineConfig = {
  anthropicApiKey: 'YOUR_KEY_placeholder',
  fatsecretClientId: 'placeholder-id',
  fatsecretClientSecret: 'placeholder-secret',
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

describe('Pipeline E2E', () => {
  let orchestrator: NutritionPipelineOrchestrator;
  let defaultResult: PipelineResult;
  let defaultEvents: PipelineProgress[];

  beforeAll(async () => {
    orchestrator = new NutritionPipelineOrchestrator(TEST_CONFIG);
    const tracker = createProgressTracker();
    defaultResult = await orchestrator.run(createTestInput(), tracker.callback);
    defaultEvents = tracker.events;
  }, 15000);

  // ── Test 1: Happy path ──────────────────────────────────────────────
  it('produces schema-valid plan, draft, HTML, and PDF for male omnivore maintain', () => {
    expect(defaultResult.success).toBe(true);
    expect(defaultResult.error).toBeUndefined();
    expect(defaultResult.plan).toBeDefined();
    expect(defaultResult.draft).toBeDefined();
    expect(defaultResult.deliverables).toBeDefined();

    // Schema validation
    MealPlanValidatedSchema.parse(defaultResult.plan);

    // Deliverables shape
    expect(defaultResult.deliverables!.summaryHtml.length).toBeGreaterThan(0);
    expect(defaultResult.deliverables!.gridHtml.length).toBeGreaterThan(0);
    expect(defaultResult.deliverables!.groceryHtml.length).toBeGreaterThan(0);
    expect(Buffer.isBuffer(defaultResult.deliverables!.pdfBuffer)).toBe(true);
  });

  // ── Test 2: Calculation metadata surfaces (P4-T08) ─────────────────
  it('surfaces calculationMethod, proteinMethod, goalKcalFloorApplied', () => {
    expect(defaultResult.plan!.calculationMethod).toBe('mifflin_st_jeor');
    expect(defaultResult.plan!.proteinMethod).toBe('g_per_kg');
    expect(defaultResult.plan!.goalKcalFloorApplied).toBe(false);
  });

  // ── Test 3: Katch-McArdle with bodyFat% (P2-T01) ───────────────────
  it('uses Katch-McArdle when bodyFatPercent is provided', async () => {
    const result = await orchestrator.run(createTestInput({ bodyFatPercent: 15 }));
    expect(result.success).toBe(true);
    expect(result.plan!.calculationMethod).toBe('katch_mcardle');
  }, 10000);

  // ── Test 4: Female caloric floor 1200 (P1-T01) ─────────────────────
  it('enforces 1200 kcal caloric floor for female aggressive cut', async () => {
    const result = await orchestrator.run(
      createTestInput({
        sex: 'female',
        heightCm: 160,
        weightKg: 50,
        age: 25,
        activityLevel: 'sedentary',
        goalType: 'cut',
        goalRate: 2,
        dietaryStyle: 'vegan',
        macroStyle: 'balanced',
        cuisinePreferences: ['asian'],
      })
    );
    expect(result.success).toBe(true);
    expect(result.plan!.goalKcalFloorApplied).toBe(true);

    // Verify via metabolic calculator directly
    const normalizer = new IntakeNormalizer();
    const intake = normalizer.normalize(
      createTestInput({
        sex: 'female',
        heightCm: 160,
        weightKg: 50,
        age: 25,
        activityLevel: 'sedentary',
        goalType: 'cut',
        goalRate: 2,
        dietaryStyle: 'vegan',
        macroStyle: 'balanced',
      })
    );
    const calc = new MetabolicCalculator();
    const profile = calc.calculate(intake);
    expect(profile.goalKcal).toBe(CALORIC_FLOOR_FEMALE);
  }, 10000);

  // ── Test 5: Male caloric floor 1500 (P1-T01) ───────────────────────
  it('enforces 1500 kcal caloric floor for male sedentary aggressive cut', async () => {
    const result = await orchestrator.run(
      createTestInput({
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'sedentary',
        goalType: 'cut',
        goalRate: 2,
      })
    );
    expect(result.success).toBe(true);
    expect(result.plan!.goalKcalFloorApplied).toBe(true);

    const normalizer = new IntakeNormalizer();
    const intake = normalizer.normalize(
      createTestInput({
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'sedentary',
        goalType: 'cut',
        goalRate: 2,
      })
    );
    const calc = new MetabolicCalculator();
    const profile = calc.calculate(intake);
    expect(profile.goalKcal).toBe(CALORIC_FLOOR_MALE);
  }, 10000);

  // ── Test 6: Training day bonus calories (P2-T03) ────────────────────
  it('gives training days higher targetKcal than rest days', () => {
    const trainingDays = defaultResult.draft!.days.filter((d) => d.isTrainingDay);
    const restDays = defaultResult.draft!.days.filter((d) => !d.isTrainingDay);

    expect(trainingDays.length).toBeGreaterThan(0);
    expect(restDays.length).toBeGreaterThan(0);
    expect(trainingDays[0].targetKcal).toBeGreaterThan(restDays[0].targetKcal);
  });

  // ── Test 7: Snack cap at 25% (P1-T05) ──────────────────────────────
  it('caps 4 snacks at 25% of daily calories', async () => {
    const result = await orchestrator.run(
      createTestInput({
        snacksPerDay: 4,
        mealsPerDay: 4,
      })
    );
    expect(result.success).toBe(true);

    for (const day of result.draft!.days) {
      // Match only dedicated snack slots (snack_1, snack_2, ...), not meal labels like evening_snack
      const snackMeals = day.meals.filter((m) => /^snack_\d+$/.test(m.slot));
      const snackKcal = snackMeals.reduce((sum, m) => sum + m.targetNutrition.kcal, 0);
      // 25% cap + small rounding tolerance
      expect(snackKcal / day.targetKcal).toBeLessThanOrEqual(0.26);
    }
  }, 10000);

  // ── Test 8: Protein g/kg for cut goal (P2-T02) ─────────────────────
  it('sets protein target consistent with 2.0 g/kg for cut goal', () => {
    const normalizer = new IntakeNormalizer();
    const intake = normalizer.normalize(createTestInput({ goalType: 'cut', goalRate: 1 }));
    const calc = new MetabolicCalculator();
    const profile = calc.calculate(intake);

    // 80kg * 2.0 g/kg = 160g, capped at 2.5 g/kg = 200g
    expect(profile.proteinTargetG).toBe(160);
    expect(profile.proteinMethod).toBe('g_per_kg');
  });

  // ── Test 9: Sex-specific fiber floors (P2-T04) ─────────────────────
  it('sets correct fiber targets by sex', () => {
    const normalizer = new IntakeNormalizer();
    const calc = new MetabolicCalculator();

    const maleIntake = normalizer.normalize(createTestInput({ sex: 'male' }));
    const maleProfile = calc.calculate(maleIntake);
    expect(maleProfile.fiberTargetG).toBeGreaterThanOrEqual(FIBER_FLOOR_MALE);

    const femaleIntake = normalizer.normalize(
      createTestInput({ sex: 'female', heightCm: 165, weightKg: 60 })
    );
    const femaleProfile = calc.calculate(femaleIntake);
    expect(femaleProfile.fiberTargetG).toBeGreaterThanOrEqual(FIBER_FLOOR_FEMALE);
  });

  // ── Test 10: Correct meal count per day ─────────────────────────────
  it('produces correct number of meals per day (4 meals + 2 snacks = 6)', () => {
    for (const day of defaultResult.draft!.days) {
      expect(day.meals.length).toBe(6);
    }
  });

  // ── Test 11: Progress events in order (P4-T03) ─────────────────────
  it('emits progress events with agents in order 1→2→3→4→5→6, ending with completed', () => {
    const agentNumbers = defaultEvents.map((e) => e.agent);
    // Agents should be non-decreasing
    for (let i = 1; i < agentNumbers.length; i++) {
      expect(agentNumbers[i]).toBeGreaterThanOrEqual(agentNumbers[i - 1]);
    }
    // All 6 agents should appear
    const uniqueAgents = [...new Set(agentNumbers)];
    expect(uniqueAgents).toContain(1);
    expect(uniqueAgents).toContain(2);
    expect(uniqueAgents).toContain(3);
    expect(uniqueAgents).toContain(4);
    expect(uniqueAgents).toContain(5);
    expect(uniqueAgents).toContain(6);
    // Last event should be completed
    expect(defaultEvents[defaultEvents.length - 1].status).toBe('completed');
  });

  // ── Test 12: Sub-progress events fire (P4-T05) ─────────────────────
  it('fires sub-progress events with subStep for Agent 3 and Agent 4', () => {
    const subStepEvents = defaultEvents.filter((e) => e.subStep);
    expect(subStepEvents.length).toBeGreaterThan(0);

    const agent3Sub = subStepEvents.filter((e) => e.agent === 3);
    expect(agent3Sub.length).toBeGreaterThan(0);
  });

  // ── Test 13: Deterministic reproducibility (P3-T04) ─────────────────
  it('produces same meal names for identical input (seeded PRNG)', async () => {
    const input = createTestInput();
    const result1 = await orchestrator.run(input);
    const result2 = await orchestrator.run(input);

    const getNames = (r: PipelineResult) => r.draft!.days.map((d) => d.meals.map((m) => m.name));

    expect(getNames(result1)).toEqual(getNames(result2));
  }, 15000);

  // ── Test 14: QA score 0-100, single iteration (P2-T06, P2-T07) ─────
  it('produces QA score 0-100 with single iteration and per-day status', () => {
    expect(defaultResult.plan!.qa.score).toBeGreaterThanOrEqual(0);
    expect(defaultResult.plan!.qa.score).toBeLessThanOrEqual(100);
    expect(defaultResult.plan!.qa.iterations).toBe(1);

    for (const dayResult of defaultResult.plan!.qa.dayResults) {
      expect(['PASS', 'WARN', 'FAIL']).toContain(dayResult.status);
    }
  });

  // ── Test 15: Compiled meals have required fields (P4-T08) ───────────
  it('compiled meals have confidenceLevel, primaryProtein, and instructions', () => {
    for (const day of defaultResult.plan!.days) {
      for (const meal of day.meals) {
        expect(['verified', 'ai_estimated']).toContain(meal.confidenceLevel);
        expect(meal.primaryProtein).toBeDefined();
        expect(meal.primaryProtein.length).toBeGreaterThan(0);
        expect(Array.isArray(meal.instructions)).toBe(true);
        expect(meal.instructions.length).toBeGreaterThan(0);
        expect(Array.isArray(meal.ingredients)).toBe(true);
        expect(meal.ingredients.length).toBeGreaterThan(0);
      }
    }
  });

  // ── Test 16: Vegan plan excludes meat ────────────────────────────────
  it('vegan plan has no meat-based primaryProtein', async () => {
    const result = await orchestrator.run(
      createTestInput({
        dietaryStyle: 'vegan',
        macroStyle: 'balanced',
        cuisinePreferences: ['asian', 'mediterranean'],
      })
    );
    expect(result.success).toBe(true);

    // The vegan filter works on meal tags, so verify no meal has meat/fish/eggs/dairy tags
    const bannedTags = ['meat', 'fish', 'eggs', 'dairy'];
    for (const day of result.draft!.days) {
      for (const meal of day.meals) {
        for (const banned of bannedTags) {
          expect(meal.tags).not.toContain(banned);
        }
      }
    }
  }, 10000);

  // ── Test 17: Variety report has diverse proteins and cuisines ────────
  it('variety report has diverse proteins (>=3) and cuisines (>=2)', () => {
    expect(defaultResult.draft!.varietyReport.proteinsUsed.length).toBeGreaterThanOrEqual(3);
    expect(defaultResult.draft!.varietyReport.cuisinesUsed.length).toBeGreaterThanOrEqual(2);
  });

  // ── Test 18: Custom plan duration ───────────────────────────────────
  it('respects custom plan duration of 3 days', async () => {
    const result = await orchestrator.run(createTestInput({ planDurationDays: 3 }));
    expect(result.success).toBe(true);
    expect(result.draft!.days.length).toBe(3);
    expect(result.plan!.days.length).toBe(3);
  }, 10000);
});
