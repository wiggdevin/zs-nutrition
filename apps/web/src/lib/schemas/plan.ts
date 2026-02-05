import { z } from 'zod'

// ---------------------------------------------------------------------------
// Nutrition data within a meal (permissive: accepts multiple naming conventions)
// ---------------------------------------------------------------------------
const MealNutritionSchema = z.object({
  kcal: z.number().optional(),
  calories: z.number().optional(),
  proteinG: z.number().optional(),
  protein: z.number().optional(),
  carbsG: z.number().optional(),
  carbs: z.number().optional(),
  fatG: z.number().optional(),
  fat: z.number().optional(),
  fiberG: z.number().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// A single meal in the plan
// ---------------------------------------------------------------------------
const PlanMealSchema = z.object({
  slot: z.string().optional(),
  name: z.string().optional(),
  cuisine: z.string().optional(),
  prepTimeMin: z.number().optional(),
  cookTimeMin: z.number().optional(),
  confidenceLevel: z.string().optional(),
  nutrition: MealNutritionSchema.optional(),
  estimatedNutrition: MealNutritionSchema.optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// A single day in the plan
// ---------------------------------------------------------------------------
const PlanDaySchema = z.object({
  dayNumber: z.number(),
  meals: z.array(PlanMealSchema).default([]),
}).passthrough()

// ---------------------------------------------------------------------------
// The full validated plan (stored as JSON string in MealPlan.validatedPlan)
// ---------------------------------------------------------------------------
// NOTE: Inner schemas use .passthrough() so extra fields survive validation.
// Top-level exported schemas use .strip() (Zod default) so the inferred TypeScript
// types have clean property access without index-signature interference.
// Validation is still permissive: unknown nested fields are preserved, and
// corrupted top-level shapes are caught by safeParse returning the fallback.

export const ValidatedPlanSchema = z.object({
  days: z.array(PlanDaySchema).default([]),
})

// ---------------------------------------------------------------------------
// Metabolic profile (stored as JSON string in MealPlan.metabolicProfile)
// ---------------------------------------------------------------------------
export const MetabolicProfileSchema = z.object({
  bmrKcal: z.number().optional(),
  bmr: z.number().optional(),
  tdeeKcal: z.number().optional(),
  tdee: z.number().optional(),
  goalKcal: z.number().optional(),
  targetKcal: z.number().optional(),
  proteinTargetG: z.number().optional(),
  carbsTargetG: z.number().optional(),
  fatTargetG: z.number().optional(),
  macros: z.object({
    proteinG: z.number().optional(),
    carbsG: z.number().optional(),
    fatG: z.number().optional(),
  }).passthrough().optional(),
})

// ---------------------------------------------------------------------------
// Job progress (stored as JSON string in PlanGenerationJob.progress)
// ---------------------------------------------------------------------------
export const JobProgressSchema = z.object({
  agent: z.number().optional(),
  agentName: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Job result (stored as JSON string in PlanGenerationJob.result)
// ---------------------------------------------------------------------------
export const JobResultSchema = z.object({
  planId: z.string().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Onboarding step data (stored as JSON string in OnboardingState.stepData)
// ---------------------------------------------------------------------------
export const StepDataSchema = z.record(z.unknown())

// ---------------------------------------------------------------------------
// String array schema (for allergies, exclusions, cuisinePrefs, trainingDays)
// ---------------------------------------------------------------------------
export const StringArraySchema = z.array(z.string())

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type ValidatedPlan = z.infer<typeof ValidatedPlanSchema>
export type MetabolicProfile = z.infer<typeof MetabolicProfileSchema>
export type JobProgress = z.infer<typeof JobProgressSchema>
export type JobResult = z.infer<typeof JobResultSchema>
