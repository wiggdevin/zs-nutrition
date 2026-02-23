import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/safe-logger';
import { foodSearchLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { searchFoods, autocomplete, getFood } from '@/lib/food-search-service';

/**
 * GET /api/food-search?q=chicken&type=autocomplete
 * GET /api/food-search?q=chicken&type=search&max=8&page=0
 *
 * Uses local USDA database (sub-5ms) instead of FatSecret API (~1s).
 * Results include `usda:` namespaced IDs.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit by IP since this is a public endpoint
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    const rateLimitResult = await checkRateLimit(foodSearchLimiter, ip);
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult.reset);
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const type = searchParams.get('type') || 'search';
    const maxStr = searchParams.get('max');
    const max = maxStr ? parseInt(maxStr, 10) : type === 'autocomplete' ? 10 : 20;
    const pageStr = searchParams.get('page');
    const page = pageStr ? parseInt(pageStr, 10) : 0;

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Reject extremely long queries to prevent abuse
    const MAX_QUERY_LENGTH = 200;
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Search query too long (max ${MAX_QUERY_LENGTH} characters)`, results: [] },
        { status: 400 }
      );
    }

    if (type === 'autocomplete') {
      const suggestions = await autocomplete(query, max);
      return NextResponse.json({ results: suggestions });
    }

    // Full search with food details including nutrition per serving
    const { results: foods, hasMore } = await searchFoods(query, max, page);

    // Enrich with serving data (still sub-ms since getFood hits same local DB)
    const enrichedResults = await Promise.all(
      foods.slice(0, max).map(async (food) => {
        try {
          const details = await getFood(food.foodId);
          const firstServing = details.servings?.[0];
          return {
            ...food,
            verified: true,
            servings: details.servings.map((s) => ({
              servingDescription: s.servingDescription,
              calories: s.calories,
              protein: s.protein,
              carbohydrate: s.carbohydrate,
              fat: s.fat,
            })),
            nutrition: firstServing
              ? {
                  servingDescription: firstServing.servingDescription,
                  calories: firstServing.calories,
                  protein: firstServing.protein,
                  carbohydrate: firstServing.carbohydrate,
                  fat: firstServing.fat,
                }
              : null,
          };
        } catch {
          return {
            ...food,
            verified: true,
            servings: [],
            nutrition: null,
          };
        }
      })
    );

    return NextResponse.json({ results: enrichedResults, page, hasMore });
  } catch (error) {
    logger.error('Food search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
