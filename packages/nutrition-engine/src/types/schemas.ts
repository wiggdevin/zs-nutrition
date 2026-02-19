import { z } from 'zod';

// ============================================================
// Enums
// ============================================================

export const SexEnum = z.enum(['male', 'female']);
export const GoalTypeEnum = z.enum(['cut', 'maintain', 'bulk']);
export const ActivityLevelEnum = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
]);
export const DietaryStyleEnum = z.enum([
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'paleo',
]);
export const MacroStyleEnum = z.enum(['balanced', 'high_protein', 'low_carb', 'keto']);
export const WeekdayEnum = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
export const TrainingTimeEnum = z.enum(['morning', 'afternoon', 'evening']);
export const ConfidenceLevelEnum = z.enum(['verified', 'ai_estimated']);
export const QAStatusEnum = z.enum(['PASS', 'WARN', 'FAIL']);
export const TrackingSourceEnum = z.enum([
  'plan_meal',
  'fatsecret_search',
  'manual',
  'quick_add',
  'food_scan',
]);

// ============================================================
// Agent 1 Input: Raw Intake Form
// ============================================================

export const RawIntakeFormSchema = z.object({
  name: z.string().min(1),
  sex: SexEnum,
  age: z.number().int().min(18).max(100),
  heightFeet: z.number().optional(),
  heightInches: z.number().optional(),
  heightCm: z.number().optional(),
  weightLbs: z.number().optional(),
  weightKg: z.number().optional(),
  bodyFatPercent: z.number().min(3).max(60).optional(),
  goalType: GoalTypeEnum,
  goalRate: z.number().min(0).max(2),
  activityLevel: ActivityLevelEnum,
  trainingDays: z.array(WeekdayEnum),
  trainingTime: TrainingTimeEnum.optional(),
  dietaryStyle: DietaryStyleEnum,
  allergies: z.array(z.string()),
  exclusions: z.array(z.string()),
  cuisinePreferences: z.array(z.string()),
  mealsPerDay: z.number().int().min(2).max(6),
  snacksPerDay: z.number().int().min(0).max(4),
  cookingSkill: z.number().int().min(1).max(10),
  prepTimeMaxMin: z.number().int().min(10).max(120),
  macroStyle: MacroStyleEnum,
  planDurationDays: z.number().int().min(1).max(7).default(7),
});

export type RawIntakeForm = z.infer<typeof RawIntakeFormSchema>;

// ============================================================
// Agent 1 Output: Client Intake (Normalized)
// ============================================================

export const ClientIntakeSchema = z.object({
  name: z.string().min(1),
  sex: SexEnum,
  age: z.number().int().min(18).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  bodyFatPercent: z.number().min(3).max(60).optional(),
  goalType: GoalTypeEnum,
  goalRate: z.number().min(0).max(2),
  activityLevel: ActivityLevelEnum,
  trainingDays: z.array(WeekdayEnum),
  trainingTime: TrainingTimeEnum.optional(),
  dietaryStyle: DietaryStyleEnum,
  allergies: z.array(z.string()),
  exclusions: z.array(z.string()),
  cuisinePreferences: z.array(z.string()),
  mealsPerDay: z.number().int().min(2).max(6),
  snacksPerDay: z.number().int().min(0).max(4),
  cookingSkill: z.number().int().min(1).max(10),
  prepTimeMaxMin: z.number().int().min(10).max(120),
  macroStyle: MacroStyleEnum,
  planDurationDays: z.number().int().min(1).max(7),
  constraintWarnings: z.array(z.string()).default([]),
  constraintsCompatible: z.boolean().default(true),
});

export type ClientIntake = z.infer<typeof ClientIntakeSchema>;

// ============================================================
// Agent 2 Output: Metabolic Profile
// ============================================================

export const MealTargetSchema = z.object({
  slot: z.string(),
  label: z.string(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  percentOfDaily: z.number(),
});

export const MetabolicProfileSchema = z.object({
  bmrKcal: z.number().int(),
  tdeeKcal: z.number().int(),
  goalKcal: z.number().int(),
  goalKcalFloorApplied: z.boolean(),
  proteinTargetG: z.number().int(),
  carbsTargetG: z.number().int(),
  fatTargetG: z.number().int(),
  fiberTargetG: z.number().int(),
  mealTargets: z.array(MealTargetSchema),
  trainingDayBonusKcal: z.number().int(),
  restDayKcal: z.number().int(),
  trainingDayKcal: z.number().int(),
  trainingDayMacros: z
    .object({
      proteinG: z.number().int(),
      carbsG: z.number().int(),
      fatG: z.number().int(),
    })
    .optional(),
  calculationMethod: z.enum(['mifflin_st_jeor', 'katch_mcardle']),
  proteinMethod: z.enum(['g_per_kg', 'percentage']),
  macroSplit: z.object({
    proteinPercent: z.number(),
    carbsPercent: z.number(),
    fatPercent: z.number(),
  }),
  biometricAdjustment: z
    .object({
      applied: z.boolean(),
      recoveryState: z.string(),
      trainingBonusModifier: z.number(),
      baseCalorieAdjustment: z.number().int(),
      proteinAdjustmentG: z.number().int(),
      reason: z.string(),
    })
    .optional(),
});

export type MetabolicProfile = z.infer<typeof MetabolicProfileSchema>;
export type MealTarget = z.infer<typeof MealTargetSchema>;

// ============================================================
// Agent 3 Output: Meal Plan Draft
// ============================================================

export const EstimatedNutritionSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

export const DraftMealSchema = z.object({
  slot: z.string(),
  name: z.string(),
  cuisine: z.string(),
  prepTimeMin: z.number(),
  cookTimeMin: z.number(),
  estimatedNutrition: EstimatedNutritionSchema,
  targetNutrition: EstimatedNutritionSchema, // Target nutrition for this meal slot
  fatsecretSearchQuery: z.string(),
  suggestedServings: z.number(),
  primaryProtein: z.string(),
  tags: z.array(z.string()),
});

export const DraftDaySchema = z.object({
  dayNumber: z.number().int(),
  dayName: z.string(),
  isTrainingDay: z.boolean(),
  targetKcal: z.number(),
  meals: z.array(DraftMealSchema),
});

export const MealPlanDraftSchema = z.object({
  days: z.array(DraftDaySchema),
  varietyReport: z.object({
    proteinsUsed: z.array(z.string()),
    cuisinesUsed: z.array(z.string()),
    recipeIdsUsed: z.array(z.string()),
  }),
});

export type MealPlanDraft = z.infer<typeof MealPlanDraftSchema>;
export type DraftDay = z.infer<typeof DraftDaySchema>;
export type DraftMeal = z.infer<typeof DraftMealSchema>;

// ============================================================
// Agent 4 Output: Meal Plan Compiled
// ============================================================

export const VerifiedNutritionSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number().optional(),
});

export const IngredientSchema = z.object({
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
  fatsecretFoodId: z.string().optional(),
});

export const CompiledMealSchema = z.object({
  slot: z.string(),
  name: z.string(),
  cuisine: z.string(),
  prepTimeMin: z.number(),
  cookTimeMin: z.number(),
  servings: z.number(),
  nutrition: VerifiedNutritionSchema,
  fatsecretRecipeId: z.string().optional(),
  confidenceLevel: ConfidenceLevelEnum,
  ingredients: z.array(IngredientSchema),
  instructions: z.array(z.string()),
  primaryProtein: z.string(),
  tags: z.array(z.string()),
});

export const MacroTargetsSchema = z.object({
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

export const CompiledDaySchema = z.object({
  dayNumber: z.number().int(),
  dayName: z.string(),
  isTrainingDay: z.boolean(),
  targetKcal: z.number(),
  macroTargets: MacroTargetsSchema.optional(),
  meals: z.array(CompiledMealSchema),
  dailyTotals: VerifiedNutritionSchema,
  varianceKcal: z.number(),
  variancePercent: z.number(),
});

export const MealPlanCompiledSchema = z.object({
  days: z.array(CompiledDaySchema),
  weeklyAverages: z.object({
    kcal: z.number(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
  }),
});

export type MealPlanCompiled = z.infer<typeof MealPlanCompiledSchema>;
export type CompiledDay = z.infer<typeof CompiledDaySchema>;
export type CompiledMeal = z.infer<typeof CompiledMealSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;

// ============================================================
// Agent 5 Output: Meal Plan Validated
// ============================================================

export const GroceryItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
});

export const GroceryCategorySchema = z.object({
  category: z.string(),
  items: z.array(GroceryItemSchema),
});

export const DayQAResultSchema = z.object({
  dayNumber: z.number().int(),
  variancePercent: z.number(),
  status: QAStatusEnum,
  macroVariances: z
    .object({
      proteinPercent: z.number(),
      carbsPercent: z.number(),
      fatPercent: z.number(),
    })
    .optional(),
});

export const QAResultSchema = z.object({
  status: QAStatusEnum,
  score: z.number().min(0).max(100),
  dayResults: z.array(DayQAResultSchema),
  iterations: z.number().int(),
  adjustmentsMade: z.array(z.string()),
});

export const MealPlanValidatedSchema = z.object({
  days: z.array(CompiledDaySchema),
  groceryList: z.array(GroceryCategorySchema),
  qa: QAResultSchema,
  weeklyTotals: z.object({
    avgKcal: z.number(),
    avgProteinG: z.number(),
    avgCarbsG: z.number(),
    avgFatG: z.number(),
  }),
  generatedAt: z.string().datetime(),
  engineVersion: z.string(),
  // Calculation metadata (populated by orchestrator, optional for backward compat)
  calculationMethod: z.enum(['mifflin_st_jeor', 'katch_mcardle']).optional(),
  proteinMethod: z.enum(['g_per_kg', 'percentage']).optional(),
  goalKcalFloorApplied: z.boolean().optional(),
});

export type MealPlanValidated = z.infer<typeof MealPlanValidatedSchema>;
export type QAResult = z.infer<typeof QAResultSchema>;
export type GroceryCategory = z.infer<typeof GroceryCategorySchema>;

// ============================================================
// Pipeline Progress
// ============================================================

export const PipelineProgressSchema = z.object({
  status: z.enum(['running', 'completed', 'failed']),
  agent: z.number().int().min(0).max(6),
  agentName: z.string(),
  message: z.string(),
  subStep: z.string().optional(),
  planId: z.string().optional(),
  error: z.string().optional(),
});

export type PipelineProgress = z.infer<typeof PipelineProgressSchema>;

// ============================================================
// FatSecret API Response Schemas
// ============================================================

export const FoodSearchResultSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  description: z.string(),
  brandName: z.string().optional(),
});

export const FoodServingSchema = z.object({
  servingId: z.string(),
  servingDescription: z.string(),
  metricServingAmount: z.number().optional(),
  metricServingUnit: z.string().optional(),
  calories: z.number(),
  protein: z.number(),
  carbohydrate: z.number(),
  fat: z.number(),
  fiber: z.number().optional(),
});

export const FoodDetailsSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  brandName: z.string().optional(),
  servings: z.array(FoodServingSchema),
});

export const RecipeSearchResultSchema = z.object({
  recipeId: z.string(),
  name: z.string(),
  description: z.string(),
  preparationTimeMin: z.number().optional(),
  cookingTimeMin: z.number().optional(),
});

export const RecipeIngredientSchema = z.object({
  foodId: z.string().optional(),
  name: z.string(),
  amount: z.string(),
});

export const RecipeDirectionSchema = z.object({
  stepNumber: z.number(),
  description: z.string(),
});

export const RecipeDetailsSchema = z.object({
  recipeId: z.string(),
  name: z.string(),
  description: z.string(),
  preparationTimeMin: z.number().optional(),
  cookingTimeMin: z.number().optional(),
  servingSize: z.number(),
  ingredients: z.array(RecipeIngredientSchema),
  directions: z.array(RecipeDirectionSchema),
  nutrition: z.object({
    calories: z.number(),
    protein: z.number(),
    carbohydrate: z.number(),
    fat: z.number(),
    fiber: z.number().optional(),
  }),
});

// Type exports for FatSecret schemas
export type FoodSearchResult = z.infer<typeof FoodSearchResultSchema>;
export type FoodServing = z.infer<typeof FoodServingSchema>;
export type FoodDetails = z.infer<typeof FoodDetailsSchema>;
export type RecipeSearchResult = z.infer<typeof RecipeSearchResultSchema>;
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RecipeDirection = z.infer<typeof RecipeDirectionSchema>;
export type RecipeDetails = z.infer<typeof RecipeDetailsSchema>;
