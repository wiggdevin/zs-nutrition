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

// Metabolic Calculation Utilities (shared across web app)
export {
  // Constants
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
  // Functions
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  getTrainingDayBonus,
} from './agents/metabolic-calculator';

// Adapters
export { FatSecretAdapter } from './adapters/fatsecret';
export { USDAAdapter } from './adapters/usda';

// Data - Meal Database
export {
  MEAL_DATABASE,
  getMealsBySlot,
  getMealsByDiet,
  getAvailableSlots,
  getAllSlots,
  getTotalMealCount,
  getMealCountBySlot,
  getAvailableCuisines,
  getAvailableProteins,
} from './data/meal-database';
export type { MealCandidate, MealDatabaseSlot, ExtendedMealSlot } from './data/meal-database';

// Orchestrator
export { NutritionPipelineOrchestrator } from './orchestrator';
export type { PipelineConfig, PipelineResult } from './orchestrator';
