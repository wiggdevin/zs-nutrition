// @zero-sum/nutrition-engine — Barrel exports
// Standalone AI nutrition pipeline package

// Types & Schemas
export * from './types/schemas';

// Agents
export { IntakeNormalizer } from './agents/intake-normalizer';
export { MetabolicCalculator } from './agents/metabolic-calculator';
export { RecipeCurator } from './agents/recipe-curator';
export { NutritionCompiler } from './agents/nutrition-compiler';
export { QAValidator } from './agents/qa-validator';
export { BrandRenderer } from './agents/brand-renderer';

// Adapters
export { FatSecretAdapter } from './adapters/fatsecret';

// Orchestrator
export { NutritionPipelineOrchestrator } from './orchestrator';
export type { PipelineConfig, PipelineResult } from './orchestrator';
