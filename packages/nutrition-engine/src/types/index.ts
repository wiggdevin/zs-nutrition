// Shared Zod schemas for the nutrition engine pipeline
// These schemas define the data contracts between agents
// and are shared with the web app via tRPC for end-to-end type safety

// Enums
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
} from './schemas';

// Schemas
export {
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
} from './schemas';

// Types
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
} from './schemas';

// Biometric context types
export type {
  SleepQuality,
  StressLevel,
  RecoveryState,
  BiometricContext,
} from './biometric-context';
