import { NextRequest, NextResponse } from 'next/server'
import { FatSecretAdapter } from '@zero-sum/nutrition-engine'
import { logger } from '@/lib/safe-logger'
import { foodSearchLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit'

// Singleton FatSecret adapter instance
let fatSecretAdapter: FatSecretAdapter | null = null

function getFatSecretAdapter(): FatSecretAdapter {
  if (!fatSecretAdapter) {
    fatSecretAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )
  }
  return fatSecretAdapter
}

/**
 * GET /api/food-search?q=chicken&type=autocomplete
 * GET /api/food-search?q=chicken&type=search&max=8&page=0
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit by IP since this is a public endpoint
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
    const rateLimitResult = await checkRateLimit(foodSearchLimiter, ip)
    if (rateLimitResult && !rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult.reset)
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'search'
    const maxStr = searchParams.get('max')
    const max = maxStr ? parseInt(maxStr, 10) : (type === 'autocomplete' ? 10 : 20)
    const pageStr = searchParams.get('page')
    const page = pageStr ? parseInt(pageStr, 10) : 0

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Reject extremely long queries to prevent abuse
    const MAX_QUERY_LENGTH = 200
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Search query too long (max ${MAX_QUERY_LENGTH} characters)`, results: [] },
        { status: 400 }
      )
    }

    const fatSecret = getFatSecretAdapter()

    if (type === 'autocomplete') {
      const suggestions = await fatSecret.autocomplete(query)
      return NextResponse.json({ results: suggestions })
    }

    // Full search with food details including nutrition per serving
    const foods = await fatSecret.searchFoods(query, max, page)

    // Enrich search results with nutrition data from first serving
    const enrichedResults = await Promise.all(
      foods.slice(0, max).map(async (food) => {
        try {
          const details = await fatSecret.getFood(food.foodId)
          const firstServing = details.servings?.[0]
          return {
            ...food,
            verified: true,
            servings: details.servings.map(s => ({
              servingDescription: s.servingDescription,
              calories: s.calories,
              protein: s.protein,
              carbohydrate: s.carbohydrate,
              fat: s.fat,
            })),
            nutrition: firstServing ? {
              servingDescription: firstServing.servingDescription,
              calories: firstServing.calories,
              protein: firstServing.protein,
              carbohydrate: firstServing.carbohydrate,
              fat: firstServing.fat,
            } : null,
          }
        } catch {
          return {
            ...food,
            verified: true,
            servings: [],
            nutrition: null,
          }
        }
      })
    )

    return NextResponse.json({ results: enrichedResults, page, hasMore: foods.length === max })
  } catch (error) {
    logger.error('Food search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
