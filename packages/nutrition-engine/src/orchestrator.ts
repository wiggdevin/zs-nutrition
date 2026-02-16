import { RawIntakeForm, MealPlanValidated, PipelineProgress } from './types/schemas';
import { IntakeNormalizer } from './agents/intake-normalizer';
import { MetabolicCalculator } from './agents/metabolic-calculator';
import { RecipeCurator } from './agents/recipe-curator';
import { NutritionCompiler } from './agents/nutrition-compiler';
import { QAValidator } from './agents/qa-validator';
import { BrandRenderer } from './agents/brand-renderer';
import { FatSecretAdapter } from './adapters/fatsecret';
import { USDAAdapter } from './adapters/usda';

export interface PipelineConfig {
  anthropicApiKey: string;
  fatsecretClientId: string;
  fatsecretClientSecret: string;
  usdaApiKey?: string;
}

export interface PipelineResult {
  success: boolean;
  plan?: MealPlanValidated;
  deliverables?: {
    summaryHtml: string;
    gridHtml: string;
    groceryHtml: string;
    pdfBuffer: Buffer;
  };
  error?: string;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

/**
 * Nutrition Pipeline Orchestrator
 * Runs Agent 1 → 2 → 3 → 4 → 5 → 6 sequentially.
 * Emits progress callbacks per agent stage for SSE streaming.
 */
export class NutritionPipelineOrchestrator {
  private intakeNormalizer: IntakeNormalizer;
  private metabolicCalculator: MetabolicCalculator;
  private recipeCurator: RecipeCurator;
  private nutritionCompiler: NutritionCompiler;
  private qaValidator: QAValidator;
  private brandRenderer: BrandRenderer;

  constructor(config: PipelineConfig) {
    const fatSecretAdapter = new FatSecretAdapter(
      config.fatsecretClientId,
      config.fatsecretClientSecret
    );

    const usdaAdapter = config.usdaApiKey ? new USDAAdapter(config.usdaApiKey) : undefined;

    this.intakeNormalizer = new IntakeNormalizer();
    this.metabolicCalculator = new MetabolicCalculator();
    this.recipeCurator = new RecipeCurator(config.anthropicApiKey);
    this.nutritionCompiler = new NutritionCompiler(fatSecretAdapter, usdaAdapter);
    this.qaValidator = new QAValidator();
    this.brandRenderer = new BrandRenderer();
  }

  async run(input: RawIntakeForm, onProgress?: ProgressCallback): Promise<PipelineResult> {
    const emit = (agent: number, agentName: string, message: string) => {
      onProgress?.({
        status: 'running',
        agent,
        agentName,
        message,
      });
    };

    const timings: Record<string, number> = {};
    const pipelineStart = Date.now();

    try {
      // Agent 1: Intake Normalizer
      emit(1, 'Intake Normalizer', 'Validating and normalizing your input...');
      let start = Date.now();
      const clientIntake = this.intakeNormalizer.normalize(input);
      timings['intakeNormalizer'] = Date.now() - start;

      // Agent 2: Metabolic Calculator
      emit(2, 'Metabolic Calculator', 'Calculating your metabolic targets...');
      start = Date.now();
      const metabolicProfile = this.metabolicCalculator.calculate(clientIntake);
      timings['metabolicCalculator'] = Date.now() - start;

      // Agent 3: Recipe Curator
      emit(3, 'Recipe Curator', 'Generating personalized meal ideas...');
      start = Date.now();
      const draft = await this.recipeCurator.generate(metabolicProfile, clientIntake);
      timings['recipeCurator'] = Date.now() - start;

      // Agent 4: Nutrition Compiler
      emit(4, 'Nutrition Compiler', 'Verifying nutrition data via FatSecret...');
      start = Date.now();
      const compiled = await this.nutritionCompiler.compile(draft);
      timings['nutritionCompiler'] = Date.now() - start;

      // Agent 5: QA Validator
      emit(5, 'QA Validator', 'Running quality assurance checks...');
      start = Date.now();
      const validated = await this.qaValidator.validate(compiled);
      timings['qaValidator'] = Date.now() - start;

      // Agent 6: Brand Renderer
      emit(6, 'Brand Renderer', 'Generating your meal plan deliverables...');
      start = Date.now();
      const deliverables = await this.brandRenderer.render(validated);
      timings['brandRenderer'] = Date.now() - start;

      const totalTime = Date.now() - pipelineStart;

      // Log structured timing data
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'Pipeline completed',
          timings,
          totalTime,
          timestamp: new Date().toISOString(),
        })
      );

      onProgress?.({
        status: 'completed',
        agent: 6,
        agentName: 'Brand Renderer',
        message: 'Your meal plan is ready!',
      });

      return {
        success: true,
        plan: validated,
        deliverables,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      const totalTime = Date.now() - pipelineStart;

      // Log structured error data with timings
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Pipeline failed',
          error: errorMessage,
          timings,
          totalTime,
          timestamp: new Date().toISOString(),
        })
      );

      onProgress?.({
        status: 'failed',
        agent: 0,
        agentName: 'Pipeline',
        message: errorMessage,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
