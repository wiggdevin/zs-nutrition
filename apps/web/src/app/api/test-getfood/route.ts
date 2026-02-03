import { NextRequest, NextResponse } from 'next/server'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'
import { safeLogError } from '@/lib/safe-logger'

/**
 * Test endpoint for Feature #152: FatSecret adapter getFood returns details
 *
 * GET /api/test-getfood?foodId=local-8
 * GET /api/test-getfood?search=banana  (searches first, then gets food by ID)
 *
 * Verifies:
 * 1. Search for a food, get its ID
 * 2. Call getFood(foodId)
 * 3. Verify full nutrition data returned
 * 4. Verify multiple serving sizes available
 * 5. Verify all macro values present (kcal, protein, carbs, fat)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const foodId = searchParams.get('foodId')
    const searchQuery = searchParams.get('search') || 'banana'

    const adapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )

    // Step 1: Search for a food to get its ID
    const searchResults = await adapter.searchFoods(searchQuery, 5)
    const searchStep = {
      query: searchQuery,
      resultsCount: searchResults.length,
      results: searchResults.map(r => ({ foodId: r.foodId, name: r.name })),
      passed: searchResults.length > 0,
    }

    // Use provided foodId or first search result
    const targetFoodId = foodId || (searchResults.length > 0 ? searchResults[0].foodId : null)

    if (!targetFoodId) {
      return NextResponse.json({
        error: 'No food found to test with',
        searchStep,
      }, { status: 404 })
    }

    // Step 2: Call getFood(foodId)
    const foodDetails = await adapter.getFood(targetFoodId)

    // Step 3: Verify full nutrition data returned
    const hasFullNutritionData = foodDetails.servings.length > 0 && foodDetails.servings.every(s =>
      typeof s.calories === 'number' &&
      typeof s.protein === 'number' &&
      typeof s.carbohydrate === 'number' &&
      typeof s.fat === 'number'
    )

    // Step 4: Verify multiple serving sizes available
    const hasMultipleServings = foodDetails.servings.length >= 2

    // Step 5: Verify all macro values present (kcal, protein, carbs, fat)
    const macroCheck = foodDetails.servings.map(s => ({
      servingDescription: s.servingDescription,
      calories: s.calories,
      protein: s.protein,
      carbohydrate: s.carbohydrate,
      fat: s.fat,
      fiber: s.fiber,
      metricServingAmount: s.metricServingAmount,
      metricServingUnit: s.metricServingUnit,
      hasCal: typeof s.calories === 'number' && s.calories >= 0,
      hasProtein: typeof s.protein === 'number' && s.protein >= 0,
      hasCarbs: typeof s.carbohydrate === 'number' && s.carbohydrate >= 0,
      hasFat: typeof s.fat === 'number' && s.fat >= 0,
    }))

    const allMacrosPresent = macroCheck.every(m => m.hasCal && m.hasProtein && m.hasCarbs && m.hasFat)

    // Overall validation
    const checks = {
      'step1_search_found_food': searchStep.passed,
      'step2_getFood_returned_details': !!foodDetails && !!foodDetails.foodId && !!foodDetails.name,
      'step3_full_nutrition_data': hasFullNutritionData,
      'step4_multiple_servings': hasMultipleServings,
      'step5_all_macros_present': allMacrosPresent,
    }

    const allPassing = Object.values(checks).every(v => v === true)

    return NextResponse.json({
      allTestsPassing: allPassing,
      checks,
      searchStep,
      foodDetails: {
        foodId: foodDetails.foodId,
        name: foodDetails.name,
        brandName: foodDetails.brandName,
        servingCount: foodDetails.servings.length,
        servings: macroCheck,
      },
    })
  } catch (error) {
    safeLogError('getFood test error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
