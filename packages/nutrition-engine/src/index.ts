// @zero-sum/nutrition-engine — Barrel exports
// Standalone AI nutrition pipeline package

// Types & Schemas (named exports for tree-shaking)
export {
  SexEnum,
  GoalTypeEnum,
  ActivityLevelEnum,
  DietaryStyleEnum,
  MacroStyleEnum,
  WeekdayEnum,
  TrainingTimeEnum,
  ConfidenceLevelEnum,
  QAStatusEnum,
  TrackingSourceEnum,
  RawIntakeFormSchema,
  ClientIntakeSchema,
  MealTargetSchema,
  MetabolicProfileSchema,
  EstimatedNutritionSchema,
  DraftMealSchema,
  DraftDaySchema,
  MealPlanDraftSchema,
  VerifiedNutritionSchema,
  IngredientSchema,
  CompiledMealSchema,
  MacroTargetsSchema,
  CompiledDaySchema,
  MealPlanCompiledSchema,
  GroceryItemSchema,
  GroceryCategorySchema,
  DayQAResultSchema,
  QAResultSchema,
  MealPlanValidatedSchema,
  PipelineProgressSchema,
  FoodSearchResultSchema,
  FoodServingSchema,
  FoodDetailsSchema,
  RecipeSearchResultSchema,
  RecipeIngredientSchema,
  RecipeDirectionSchema,
  RecipeDetailsSchema,
} from './types/schemas';
export type {
  RawIntakeForm,
  ClientIntake,
  MetabolicProfile,
  MealTarget,
  MealPlanDraft,
  DraftDay,
  DraftMeal,
  MealPlanCompiled,
  CompiledDay,
  CompiledMeal,
  Ingredient,
  MealPlanValidated,
  QAResult,
  GroceryCategory,
  PipelineProgress,
  FoodSearchResult,
  FoodServing,
  FoodDetails,
  RecipeSearchResult,
  RecipeIngredient,
  RecipeDirection,
  RecipeDetails,
} from './types/schemas';

// Agents
export { IntakeNormalizer } from './agents/intake-normalizer';
export { MetabolicCalculator } from './agents/metabolic-calculator';
export { RecipeCurator } from './agents/recipe-curator';
export { NutritionCompiler } from './agents/nutrition-compiler';
export { QAValidator } from './agents/qa-validator';
export { BrandRenderer, renderHtml, renderPdf, closeBrowserPool } from './agents/brand-renderer';
export type { HtmlRenderResult } from './agents/brand-renderer';
export { CacheWarmer } from './agents/cache-warmer';

// Metabolic Calculation Utilities (shared across web app)
export {
  // Constants
  ACTIVITY_MULTIPLIERS,
  MACRO_SPLITS,
  TRAINING_DAY_BONUS,
  MEAL_DISTRIBUTIONS,
  MEAL_LABELS,
  CALORIC_FLOOR_FEMALE,
  CALORIC_FLOOR_MALE,
  SNACK_ALLOCATION_CAP,
  PROTEIN_G_PER_KG,
  FIBER_FLOOR_FEMALE,
  FIBER_FLOOR_MALE,
  // Functions
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroTargets,
  calculateProteinG,
  getTrainingDayBonus,
} from './agents/metabolic-calculator';

// Adapters
export { FatSecretAdapter, fatSecretCircuitBreaker } from './adapters/fatsecret';
export type { CircuitBreakerState } from './adapters/fatsecret';
export { USDAAdapter } from './adapters/usda';
export { LocalUSDAAdapter } from './adapters/usda-local';
export type { ExternalFoodCache } from './adapters/food-data-types';

// Data - Food Alias Cache
export { FoodAliasCache } from './data/food-alias-cache';
export type { AliasEntry } from './data/food-alias-cache';

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

// Utilities
export { sanitizeError } from './utils/error-sanitizer';

// Config Validation
export { validatePipelineConfig, assertPipelineConfig } from './config/env-validation';
export type { PipelineEnvConfig, ValidationResult } from './config/env-validation';

// Model Config
export {
  getConfig,
  getModelConfig,
  callWithFallback,
  DEFAULT_MODEL_CONFIG,
} from './config/model-config';
export type { ModelConfig, ModelConfigMap } from './config/model-config';

// Orchestrator
export { NutritionPipelineOrchestrator } from './orchestrator';
export type { PipelineConfig, PipelineResult, FastPipelineInput } from './orchestrator';
