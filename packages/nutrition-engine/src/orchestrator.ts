import { RawIntakeForm, MealPlanValidated, MealPlanDraft, PipelineProgress } from './types/schemas';
import { IntakeNormalizer } from './agents/intake-normalizer';
import { MetabolicCalculator } from './agents/metabolic-calculator';
import { RecipeCurator } from './agents/recipe-curator';
import { NutritionCompiler } from './agents/nutrition-compiler';
import { QAValidator } from './agents/qa-validator';
import { BrandRenderer, renderHtml, renderPdf } from './agents/brand-renderer';
import { CacheWarmer } from './agents/cache-warmer';
import { BatchIngredientResolver } from './agents/recipe-curator/batch-resolver';
import { FatSecretAdapter } from './adapters/fatsecret';
import { USDAAdapter } from './adapters/usda';
import { LocalUSDAAdapter } from './adapters/usda-local';
import { FoodAliasCache } from './data/food-alias-cache';
import { assertPipelineConfig } from './config/env-validation';
import { sanitizeError } from './utils/error-sanitizer';
import { engineLogger } from './utils/logger';
import type { ExternalFoodCache } from './adapters/food-data-types';
import type { PrismaClient } from '@prisma/client';

export interface PipelineConfig {
  anthropicApiKey: string;
  usdaApiKey: string;
  fatsecretClientId?: string;
  fatsecretClientSecret?: string;
  prismaClient?: PrismaClient;
  externalFoodCache?: ExternalFoodCache;
}

export interface PipelineResult {
  success: boolean;
  plan?: MealPlanValidated;
  draft?: MealPlanDraft;
  deliverables?: {
    summaryHtml: string;
    gridHtml: string;
    groceryHtml: string;
    pdfBuffer: Buffer;
  };
  error?: string;
}

export interface FastPipelineInput {
  rawInput: RawIntakeForm;
  existingDraft: MealPlanDraft;
}

export type ProgressCallback = (progress: PipelineProgress) => void | Promise<void>;

/** Per-stage timeout defaults (seconds). Must be well under BullMQ lockDuration (300s). */
const STAGE_TIMEOUTS = {
  recipeCurator: 240_000,
  nutritionCompiler: 60_000,
  qaValidator: 60_000,
  brandRenderer: 120_000,
} as const;

/** Wraps a promise with a timeout. Rejects with a descriptive error if the deadline is exceeded. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Nutrition Pipeline Orchestrator (P4-T03 refactor)
 *
 * 3-stage execution model:
 *   Stage 1: IntakeNormalizer → MetabolicCalculator (sequential, <10ms)
 *   Stage 2: RecipeCurator || CacheWarmer (parallel), then NutritionCompiler
 *   Stage 3: QAValidator, then HtmlRenderer || PdfRenderer (parallel)
 *
 * Features:
 *   - Constraint gate (halts if intake.constraintsCompatible === false)
 *   - Error sanitization via sanitizeError() for user-facing messages
 *   - Sub-progress events for long-running agents (RecipeCurator, NutritionCompiler)
 *   - CacheWarmer runs parallel with RecipeCurator during Claude API wait
 *   - HtmlRenderer and PdfRenderer run in parallel in Stage 3
 */
export class NutritionPipelineOrchestrator {
  private intakeNormalizer: IntakeNormalizer;
  private metabolicCalculator: MetabolicCalculator;
  private recipeCurator: RecipeCurator;
  private nutritionCompiler: NutritionCompiler;
  private qaValidator: QAValidator;
  private brandRenderer: BrandRenderer;
  private cacheWarmer: CacheWarmer;
  private usdaAdapter: USDAAdapter;
  private fatSecretAdapter?: FatSecretAdapter;
  private localUsdaAdapter?: LocalUSDAAdapter;
  private foodAliasCache?: FoodAliasCache;

  constructor(config: PipelineConfig) {
    assertPipelineConfig(config);

    this.usdaAdapter = new USDAAdapter(config.usdaApiKey, config.externalFoodCache);

    this.fatSecretAdapter =
      config.fatsecretClientId && config.fatsecretClientSecret
        ? new FatSecretAdapter(
            config.fatsecretClientId,
            config.fatsecretClientSecret,
            config.externalFoodCache
          )
        : undefined;

    this.localUsdaAdapter = config.prismaClient
      ? new LocalUSDAAdapter(config.prismaClient)
      : undefined;

    this.foodAliasCache = config.prismaClient ? new FoodAliasCache(config.prismaClient) : undefined;

    const batchResolver = new BatchIngredientResolver(
      this.localUsdaAdapter,
      this.usdaAdapter,
      this.fatSecretAdapter,
      this.foodAliasCache
    );

    this.intakeNormalizer = new IntakeNormalizer();
    this.metabolicCalculator = new MetabolicCalculator();
    this.recipeCurator = new RecipeCurator(config.anthropicApiKey, batchResolver);
    this.nutritionCompiler = new NutritionCompiler(
      this.usdaAdapter,
      this.fatSecretAdapter,
      this.localUsdaAdapter,
      this.foodAliasCache
    );
    this.qaValidator = new QAValidator();
    this.brandRenderer = new BrandRenderer();
    this.cacheWarmer = new CacheWarmer();
  }

  /**
   * Run the full pipeline (new plan generation).
   * Agents 1→2→(3||CacheWarmer)→4→5→(6a||6b)
   */
  async run(input: RawIntakeForm, onProgress?: ProgressCallback): Promise<PipelineResult> {
    const emit = async (agent: number, agentName: string, message: string, subStep?: string) => {
      await onProgress?.({
        status: 'running',
        agent,
        agentName,
        message,
        ...(subStep ? { subStep } : {}),
      });
    };

    const timings: Record<string, number> = {};
    const pipelineStart = Date.now();

    try {
      // ──────────────────────────────────────────────
      // STAGE 1: Intake + Metabolic (sequential, <10ms)
      // ──────────────────────────────────────────────

      // Agent 1: Intake Normalizer
      await emit(1, 'Intake Normalizer', 'Validating and normalizing your input...');
      let start = Date.now();
      const clientIntake = this.intakeNormalizer.normalize(input);
      timings['intakeNormalizer'] = Date.now() - start;

      // Constraint gate: halt if constraints are incompatible
      if (!clientIntake.constraintsCompatible) {
        const warnings = clientIntake.constraintWarnings.join('; ');
        const errorMsg = `Incompatible dietary constraints: ${warnings}`;

        await onProgress?.({
          status: 'failed',
          agent: 1,
          agentName: 'Intake Normalizer',
          message: errorMsg,
          error: errorMsg,
        });

        return { success: false, error: errorMsg };
      }

      // Agent 2: Metabolic Calculator
      await emit(2, 'Metabolic Calculator', 'Calculating your metabolic targets...');
      start = Date.now();
      const metabolicProfile = this.metabolicCalculator.calculate(clientIntake);
      timings['metabolicCalculator'] = Date.now() - start;

      // Lazy-load FoodAliasCache (one-time, ~124 rows, negligible latency)
      if (this.foodAliasCache && !this.foodAliasCache.isLoaded) {
        await this.foodAliasCache.load();
      }

      // ──────────────────────────────────────────────
      // STAGE 2: Recipe Generation + Cache Warming (parallel), then Compilation
      // ──────────────────────────────────────────────

      // Agent 3: Recipe Curator (LLM call, 30-60s)
      // CacheWarmer runs in parallel during Claude wait
      await emit(3, 'Recipe Curator', 'Generating personalized meal ideas...');
      start = Date.now();

      const cacheWarmAbort = new AbortController();

      const [draft] = await withTimeout(
        Promise.all([
          // Agent 3: main path — generate meal plan via Claude
          this.recipeCurator
            .generate(metabolicProfile, clientIntake, (sub) => {
              emit(3, 'Recipe Curator', 'Generating personalized meal ideas...', sub);
            })
            .then((d) => {
              // Cancel cache warming once Claude returns (results already cached)
              cacheWarmAbort.abort();
              return d;
            }),

          // CacheWarmer: fire-and-forget, runs during Claude wait
          // Prefer local adapter when available to avoid live API calls
          this.cacheWarmer
            .warm(
              clientIntake.dietaryStyle,
              clientIntake.allergies,
              this.localUsdaAdapter
                ? (query) => this.localUsdaAdapter!.searchFoods(query, 5).then(() => undefined)
                : (query) => this.usdaAdapter.searchFoods(query, 5).then(() => undefined),
              { signal: cacheWarmAbort.signal, concurrency: 3 }
            )
            .catch(() => {
              // Fire-and-forget: errors are silent
            }),
        ]),
        STAGE_TIMEOUTS.recipeCurator,
        'RecipeCurator'
      );

      timings['recipeCurator'] = Date.now() - start;

      // Pre-compilation compliance gate: scan draft for allergen/dietary violations
      const { scanDraftForViolations } = await import('./utils/draft-compliance-gate');
      const draftViolations = scanDraftForViolations(draft, clientIntake);
      let finalDraft = draft;

      if (draftViolations.length > 0) {
        engineLogger.info(
          `[Pipeline] Compliance gate found ${draftViolations.length} violations, triggering re-generation`
        );
        await emit(3, 'Recipe Curator', 'Fixing compliance violations...');
        finalDraft = await this.recipeCurator.regenerateViolatingMeals(
          draft,
          draftViolations,
          metabolicProfile,
          clientIntake,
          2
        );
      }

      // Agent 4: Nutrition Compiler
      await emit(4, 'Nutrition Compiler', 'Verifying nutrition data...');
      start = Date.now();
      const compiled = await withTimeout(
        this.nutritionCompiler.compile(finalDraft, clientIntake, (sub) => {
          emit(4, 'Nutrition Compiler', 'Verifying nutrition data...', sub);
        }),
        STAGE_TIMEOUTS.nutritionCompiler,
        'NutritionCompiler'
      );
      timings['nutritionCompiler'] = Date.now() - start;

      // ──────────────────────────────────────────────
      // STAGE 3: QA Validation, then Rendering (parallel HTML + PDF)
      // ──────────────────────────────────────────────

      // Agent 5: QA Validator
      await emit(5, 'QA Validator', 'Running quality assurance checks...');
      start = Date.now();
      const validated = await withTimeout(
        this.qaValidator.validate(compiled, clientIntake),
        STAGE_TIMEOUTS.qaValidator,
        'QAValidator'
      );
      timings['qaValidator'] = Date.now() - start;

      // Enrich validated plan with calculation metadata for templates (P4-T08)
      validated.calculationMethod = metabolicProfile.calculationMethod;
      validated.proteinMethod = metabolicProfile.proteinMethod;
      validated.goalKcalFloorApplied = metabolicProfile.goalKcalFloorApplied;

      // Agent 6: Brand Renderer (HTML || PDF in parallel)
      await emit(6, 'Brand Renderer', 'Generating your meal plan deliverables...');
      start = Date.now();

      // Generate HTML (pure CPU, ~50-150ms)
      const { summaryHtml, gridHtml, groceryHtml } = renderHtml(validated);

      // Generate PDF (async Puppeteer, ~1-8s with browser pool)
      // Wrapped in try/catch: PDF is regenerated by save-plan.ts, so pipeline
      // should not fail if Puppeteer is unavailable (e.g. missing Chromium on Railway)
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await withTimeout(
          renderPdf(summaryHtml, gridHtml, groceryHtml),
          STAGE_TIMEOUTS.brandRenderer,
          'BrandRenderer:PDF'
        );
      } catch (pdfError) {
        engineLogger.warn(
          '[Pipeline] PDF generation failed, returning empty buffer',
          pdfError instanceof Error ? pdfError.message : String(pdfError)
        );
        pdfBuffer = Buffer.alloc(0);
      }

      timings['brandRenderer'] = Date.now() - start;

      const totalTime = Date.now() - pipelineStart;

      engineLogger.info('[Pipeline] Pipeline completed', { timings, totalTime });

      await onProgress?.({
        status: 'completed',
        agent: 6,
        agentName: 'Brand Renderer',
        message: 'Your meal plan is ready!',
      });

      return {
        success: true,
        plan: validated,
        draft: finalDraft,
        deliverables: { summaryHtml, gridHtml, groceryHtml, pdfBuffer },
      };
    } catch (error) {
      const internalMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      const userMessage = sanitizeError(error);
      const totalTime = Date.now() - pipelineStart;

      engineLogger.error('[Pipeline] Pipeline failed', {
        error: internalMessage,
        timings,
        totalTime,
      });

      await onProgress?.({
        status: 'failed',
        agent: 0,
        agentName: 'Pipeline',
        message: userMessage,
        error: userMessage,
      });

      return {
        success: false,
        error: userMessage,
      };
    }
  }

  /**
   * Run the fast pipeline (recalculation with existing draft).
   * Skips Agent 3 (RecipeCurator), reuses stored MealPlanDraft.
   * Used for calorie/macro adjustments where recipes don't need to change.
   */
  async runFast(input: FastPipelineInput, onProgress?: ProgressCallback): Promise<PipelineResult> {
    const emit = async (agent: number, agentName: string, message: string, subStep?: string) => {
      await onProgress?.({
        status: 'running',
        agent,
        agentName,
        message,
        ...(subStep ? { subStep } : {}),
      });
    };

    const timings: Record<string, number> = {};
    const pipelineStart = Date.now();

    try {
      // Stage 1: Re-validate intake + recalculate metabolic profile
      await emit(1, 'Intake Normalizer', 'Re-validating your input...');
      let start = Date.now();
      const clientIntake = this.intakeNormalizer.normalize(input.rawInput);
      timings['intakeNormalizer'] = Date.now() - start;

      if (!clientIntake.constraintsCompatible) {
        const warnings = clientIntake.constraintWarnings.join('; ');
        const errorMsg = `Incompatible dietary constraints: ${warnings}`;
        await onProgress?.({
          status: 'failed',
          agent: 1,
          agentName: 'Intake Normalizer',
          message: errorMsg,
          error: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      await emit(2, 'Metabolic Calculator', 'Recalculating your metabolic targets...');
      start = Date.now();
      this.metabolicCalculator.calculate(clientIntake);
      timings['metabolicCalculator'] = Date.now() - start;

      // Lazy-load FoodAliasCache (one-time, ~124 rows, negligible latency)
      if (this.foodAliasCache && !this.foodAliasCache.isLoaded) {
        await this.foodAliasCache.load();
      }

      // Stage 2: Skip Agent 3, re-compile with updated targets
      await emit(4, 'Nutrition Compiler', 'Re-compiling with updated targets...');
      start = Date.now();
      const compiled = await withTimeout(
        this.nutritionCompiler.compile(input.existingDraft, clientIntake, (sub) => {
          emit(4, 'Nutrition Compiler', 'Re-compiling with updated targets...', sub);
        }),
        STAGE_TIMEOUTS.nutritionCompiler,
        'NutritionCompiler'
      );
      timings['nutritionCompiler'] = Date.now() - start;

      // Stage 3: QA + Rendering
      await emit(5, 'QA Validator', 'Running quality assurance checks...');
      start = Date.now();
      const validated = await withTimeout(
        this.qaValidator.validate(compiled, clientIntake),
        STAGE_TIMEOUTS.qaValidator,
        'QAValidator'
      );
      timings['qaValidator'] = Date.now() - start;

      await emit(6, 'Brand Renderer', 'Generating your meal plan deliverables...');
      start = Date.now();
      const { summaryHtml, gridHtml, groceryHtml } = renderHtml(validated);

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await withTimeout(
          renderPdf(summaryHtml, gridHtml, groceryHtml),
          STAGE_TIMEOUTS.brandRenderer,
          'BrandRenderer:PDF'
        );
      } catch (pdfError) {
        engineLogger.warn(
          '[Pipeline] PDF generation failed (fast path), returning empty buffer',
          pdfError instanceof Error ? pdfError.message : String(pdfError)
        );
        pdfBuffer = Buffer.alloc(0);
      }

      timings['brandRenderer'] = Date.now() - start;

      const totalTime = Date.now() - pipelineStart;

      engineLogger.info('[Pipeline] Fast pipeline completed', { timings, totalTime });

      await onProgress?.({
        status: 'completed',
        agent: 6,
        agentName: 'Brand Renderer',
        message: 'Your updated meal plan is ready!',
      });

      return {
        success: true,
        plan: validated,
        draft: input.existingDraft,
        deliverables: { summaryHtml, gridHtml, groceryHtml, pdfBuffer },
      };
    } catch (error) {
      const internalMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      const userMessage = sanitizeError(error);
      const totalTime = Date.now() - pipelineStart;

      engineLogger.error('[Pipeline] Fast pipeline failed', {
        error: internalMessage,
        timings,
        totalTime,
      });

      await onProgress?.({
        status: 'failed',
        agent: 0,
        agentName: 'Pipeline',
        message: userMessage,
        error: userMessage,
      });

      return {
        success: false,
        error: userMessage,
      };
    }
  }
}
