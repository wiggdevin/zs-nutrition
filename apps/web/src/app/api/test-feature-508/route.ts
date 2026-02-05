import { NextResponse } from 'next/server';
import {
  FoodSearchResultSchema,
  FoodDetailsSchema,
  RecipeSearchResultSchema,
  RecipeDetailsSchema,
  type FoodSearchResult,
  type FoodDetails,
  type RecipeSearchResult,
  type RecipeDetails,
} from '@zero-sum/nutrition-engine';

/**
 * Test route for Feature #508: Create shared Zod schemas in nutrition-engine types
 * Verifies that FatSecret API response schemas can be imported and used in the web app
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const results: Array<{
    test: string;
    status: 'pass' | 'fail';
    message: string;
    details?: any;
  }> = [];

  // Test 1: Import FoodSearchResultSchema
  try {
    const testFood: FoodSearchResult = {
      foodId: 'fs-12345',
      name: 'Chicken Breast, Grilled',
      description: 'Per 100g - Calories: 165kcal | Protein: 31g',
      brandName: 'USDA',
    };

    const parsed = FoodSearchResultSchema.parse(testFood);
    results.push({
      test: 'FoodSearchResultSchema import and parse',
      status: 'pass',
      message: 'Successfully imported and validated FoodSearchResult',
      details: parsed,
    });
  } catch (error: any) {
    results.push({
      test: 'FoodSearchResultSchema import and parse',
      status: 'fail',
      message: error.message,
    });
  }

  // Test 2: Import FoodDetailsSchema
  try {
    const testFoodDetails: FoodDetails = {
      foodId: 'fs-12345',
      name: 'Chicken Breast, Grilled',
      brandName: 'USDA',
      servings: [
        {
          servingId: 's1',
          servingDescription: '100g',
          metricServingAmount: 100,
          metricServingUnit: 'g',
          calories: 165,
          protein: 31,
          carbohydrate: 0,
          fat: 3.6,
          fiber: 0,
        },
      ],
    };

    const parsed = FoodDetailsSchema.parse(testFoodDetails);
    results.push({
      test: 'FoodDetailsSchema import and parse',
      status: 'pass',
      message: 'Successfully imported and validated FoodDetails',
      details: { name: parsed.name, servingsCount: parsed.servings.length },
    });
  } catch (error: any) {
    results.push({
      test: 'FoodDetailsSchema import and parse',
      status: 'fail',
      message: error.message,
    });
  }

  // Test 3: Import RecipeSearchResultSchema
  try {
    const testRecipe: RecipeSearchResult = {
      recipeId: 'r-12345',
      name: 'Grilled Chicken with Lemon',
      description: 'Juicy grilled chicken with herbs',
      preparationTimeMin: 15,
      cookingTimeMin: 20,
    };

    const parsed = RecipeSearchResultSchema.parse(testRecipe);
    results.push({
      test: 'RecipeSearchResultSchema import and parse',
      status: 'pass',
      message: 'Successfully imported and validated RecipeSearchResult',
      details: parsed,
    });
  } catch (error: any) {
    results.push({
      test: 'RecipeSearchResultSchema import and parse',
      status: 'fail',
      message: error.message,
    });
  }

  // Test 4: Import RecipeDetailsSchema
  try {
    const testRecipeDetails: RecipeDetails = {
      recipeId: 'r-12345',
      name: 'Grilled Chicken with Lemon',
      description: 'Juicy grilled chicken with herbs',
      preparationTimeMin: 15,
      cookingTimeMin: 20,
      servingSize: 4,
      ingredients: [
        { name: 'Chicken Breast', amount: '500g' },
        { name: 'Lemon Juice', amount: '2 tbsp' },
      ],
      directions: [
        { stepNumber: 1, description: 'Marinate chicken' },
        { stepNumber: 2, description: 'Grill for 20 minutes' },
      ],
      nutrition: {
        calories: 300,
        protein: 35,
        carbohydrate: 5,
        fat: 12,
      },
    };

    const parsed = RecipeDetailsSchema.parse(testRecipeDetails);
    results.push({
      test: 'RecipeDetailsSchema import and parse',
      status: 'pass',
      message: 'Successfully imported and validated RecipeDetails',
      details: {
        name: parsed.name,
        ingredientsCount: parsed.ingredients.length,
        directionsCount: parsed.directions.length,
      },
    });
  } catch (error: any) {
    results.push({
      test: 'RecipeDetailsSchema import and parse',
      status: 'fail',
      message: error.message,
    });
  }

  const allPassing = results.every((r) => r.status === 'pass');

  return NextResponse.json({
    feature: 'Feature #508: Shared Zod schemas in nutrition-engine',
    overallStatus: allPassing ? 'ALL_PASSING' : 'SOME_FAILING',
    testCount: results.length,
    passingCount: results.filter((r) => r.status === 'pass').length,
    results,
  });
}
