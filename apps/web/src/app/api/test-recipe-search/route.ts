import { NextRequest, NextResponse } from 'next/server'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'
import { safeLogError } from '@/lib/safe-logger'

/**
 * Test endpoint for Feature #146: FatSecret adapter searchRecipes returns results
 * GET /api/test-recipe-search?q=grilled+chicken&max=10
 *
 * Verifies:
 * 1. searchRecipes returns array of RecipeSearchResult
 * 2. Each result has recipe name and ID
 * 3. maxResults parameter limits output
 * 4. Empty query returns empty results
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'grilled chicken'
    const maxResults = parseInt(searchParams.get('max') || '10', 10)

    const adapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )

    // Test 1: Search recipes with query
    const results = await adapter.searchRecipes(query, maxResults)

    // Test 2: Search with limited maxResults
    const limitedResults = await adapter.searchRecipes(query, 3)

    // Test 3: Empty query returns empty
    const emptyResults = await adapter.searchRecipes('', maxResults)

    // Test 4: Different query
    const salmonResults = await adapter.searchRecipes('salmon', 5)

    // Validation checks
    const checks = {
      results_is_array: Array.isArray(results),
      results_count: results.length,
      results_have_data: results.length > 0,
      each_has_recipe_name: results.every(r => typeof r.name === 'string' && r.name.length > 0),
      each_has_recipe_id: results.every(r => typeof r.recipeId === 'string' && r.recipeId.length > 0),
      max_results_limits_output: limitedResults.length <= 3,
      empty_query_returns_empty: emptyResults.length === 0,
      different_query_works: salmonResults.length > 0,
    }

    const allPassing = Object.values(checks).every(v => v === true || (typeof v === 'number' && v > 0))

    return NextResponse.json({
      query,
      maxResults,
      allTestsPassing: allPassing,
      checks,
      results,
      limitedResults,
      emptyResults,
      salmonResults,
    })
  } catch (error) {
    safeLogError('Recipe search test error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
