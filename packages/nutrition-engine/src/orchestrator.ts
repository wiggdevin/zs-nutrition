import { RawIntakeForm, MealPlanValidated, PipelineProgress } from './types/schemas';
import { IntakeNormalizer } from './agents/intake-normalizer';
import { MetabolicCalculator } from './agents/metabolic-calculator';
import { RecipeCurator } from './agents/recipe-curator';
import { NutritionCompiler } from './agents/nutrition-compiler';
import { QAValidator } from './agents/qa-validator';
import { BrandRenderer } from './agents/brand-renderer';
import { FatSecretAdapter } from './adapters/fatsecret';

export interface PipelineConfig {
  anthropicApiKey: string;
  fatsecretClientId: string;
  fatsecretClientSecret: string;
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

    this.intakeNormalizer = new IntakeNormalizer();
    this.metabolicCalculator = new MetabolicCalculator();
    this.recipeCurator = new RecipeCurator(config.anthropicApiKey);
    this.nutritionCompiler = new NutritionCompiler(fatSecretAdapter);
    this.qaValidator = new QAValidator();
    this.brandRenderer = new BrandRenderer();
  }

  async run(
    input: RawIntakeForm,
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    const emit = (agent: number, agentName: string, message: string) => {
      onProgress?.({
        status: 'running',
        agent,
        agentName,
        message,
      });
    };

    try {
      // Agent 1: Intake Normalizer
      emit(1, 'Intake Normalizer', 'Validating and normalizing your input...');
      const clientIntake = this.intakeNormalizer.normalize(input);

      // Agent 2: Metabolic Calculator
      emit(2, 'Metabolic Calculator', 'Calculating your metabolic targets...');
      const metabolicProfile = this.metabolicCalculator.calculate(clientIntake);

      // Agent 3: Recipe Curator
      emit(3, 'Recipe Curator', 'Generating personalized meal ideas...');
      const draft = await this.recipeCurator.generate(metabolicProfile, clientIntake);

      // Agent 4: Nutrition Compiler
      emit(4, 'Nutrition Compiler', 'Verifying nutrition data via FatSecret...');
      const compiled = await this.nutritionCompiler.compile(draft);

      // Agent 5: QA Validator
      emit(5, 'QA Validator', 'Running quality assurance checks...');
      const validated = await this.qaValidator.validate(compiled);

      // Agent 6: Brand Renderer
      emit(6, 'Brand Renderer', 'Generating your meal plan deliverables...');
      const deliverables = await this.brandRenderer.render(validated);

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

  /**
   * Run a meal swap: Agents 3 → 4 → 5 in isolation
   * Used for swapping individual meals within an existing plan.
   */
  async swapMeal(
    metabolicProfile: any,
    clientIntake: any,
    exclusions: string[],
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    // TODO: Implement isolated swap pipeline
    throw new Error('Meal swap pipeline not yet implemented');
  }
}
