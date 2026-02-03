import { NextRequest, NextResponse } from 'next/server'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'
import { safeLogError } from '@/lib/safe-logger'

/**
 * Test endpoint for Feature #99: FatSecret adapter searchFoods works
 * GET /api/test-fatsecret?q=chicken+breast
 *
 * Verifies:
 * 1. searchFoods returns results array
 * 2. Each result has food name and nutrition info
 * 3. Serving sizes are included
 * 4. Empty query returns empty results
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    const adapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )

    // Test 1: Search foods
    const searchResults = await adapter.searchFoods(query, 10)

    // Test 2: Get detailed nutrition for each result (up to 5)
    const detailedResults = await Promise.all(
      searchResults.slice(0, 5).map(async (food) => {
        try {
          const details = await adapter.getFood(food.foodId)
          return {
            foodId: food.foodId,
            name: food.name,
            description: food.description,
            brandName: food.brandName,
            hasNutritionInfo: details.servings.length > 0,
            servingSizes: details.servings.map(s => ({
              servingDescription: s.servingDescription,
              calories: s.calories,
              protein: s.protein,
              carbohydrate: s.carbohydrate,
              fat: s.fat,
              fiber: s.fiber,
              metricServingAmount: s.metricServingAmount,
              metricServingUnit: s.metricServingUnit,
            })),
            servingCount: details.servings.length,
          }
        } catch (err) {
          return {
            foodId: food.foodId,
            name: food.name,
            description: food.description,
            error: String(err),
          }
        }
      })
    )

    // Test 3: Empty query test
    const emptyResults = await adapter.searchFoods('', 10)

    // Validation checks
    const checks = {
      'results_is_array': Array.isArray(searchResults),
      'results_count': searchResults.length,
      'each_has_name': detailedResults.every(r => !!r.name),
      'each_has_nutrition': detailedResults.every(r => 'hasNutritionInfo' in r && r.hasNutritionInfo),
      'each_has_servings': detailedResults.every(r => 'servingCount' in r && (r.servingCount ?? 0) > 0),
      'empty_query_returns_empty': emptyResults.length === 0,
    }

    const allPassing = Object.values(checks).every(v => v === true || (typeof v === 'number' && v > 0))

    return NextResponse.json({
      query,
      allTestsPassing: allPassing,
      checks,
      results: detailedResults,
      emptyQueryResults: emptyResults,
    })
  } catch (error) {
    safeLogError('FatSecret test error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
