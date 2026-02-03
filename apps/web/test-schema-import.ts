/**
 * Test file to verify that nutrition-engine schemas can be imported in the web app
 * This is for Feature #508 verification
 */

import {
  // Core Enums
  SexEnum,
  GoalTypeEnum,
  ActivityLevelEnum,
  MacroStyleEnum,

  // Agent 1 Input/Output
  RawIntakeFormSchema,
  ClientIntakeSchema,
  type RawIntakeForm,
  type ClientIntake,

  // Agent 2 Output
  MetabolicProfileSchema,
  type MetabolicProfile,

  // Agent 3 Output
  MealPlanDraftSchema,
  type MealPlanDraft,

  // Agent 4 Output
  MealPlanCompiledSchema,
  CompiledMealSchema,
  type MealPlanCompiled,
  type CompiledMeal,

  // Agent 5 Output
  MealPlanValidatedSchema,
  type MealPlanValidated,

  // FatSecret API Schemas (NEW for Feature #508)
  FoodSearchResultSchema,
  FoodDetailsSchema,
  RecipeSearchResultSchema,
  RecipeDetailsSchema,
  type FoodSearchResult,
  type FoodDetails,
  type RecipeSearchResult,
  type RecipeDetails,
} from '@zero-sum/nutrition-engine';

// Verify imports work
console.log('✅ All schemas imported successfully');

// Verify FatSecret schemas are Zod schemas
console.log('FoodSearchResultSchema:', FoodSearchResultSchema);
console.log('FoodDetailsSchema:', FoodDetailsSchema);
console.log('RecipeSearchResultSchema:', RecipeSearchResultSchema);
console.log('RecipeDetailsSchema:', RecipeDetailsSchema);

// Test type inference
const testFoodSearch: FoodSearchResult = {
  foodId: 'test-123',
  name: 'Test Food',
  description: 'Test description',
  brandName: 'Test Brand',
};

console.log('Type inference works:', testFoodSearch);

// Verify schema parsing works
const parsedFood = FoodSearchResultSchema.parse(testFoodSearch);
console.log('Schema parsing works:', parsedFood);

export {
  // Re-export for verification
  FoodSearchResultSchema,
  FoodDetailsSchema,
  RecipeSearchResultSchema,
  RecipeDetailsSchema,
};
