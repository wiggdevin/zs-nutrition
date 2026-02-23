import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/safe-logger';
import { requireActiveUser } from '@/lib/auth';
import { checkRateLimit, foodSearchLimiter, rateLimitExceededResponse } from '@/lib/rate-limit';
import { getFood } from '@/lib/food-search-service';

/**
 * GET /api/food-search/details?id=usda:171534
 *
 * Routes to correct adapter based on ID prefix (usda: / fs: / legacy).
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    try {
      await requireActiveUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      if (message === 'Account is deactivated') {
        return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(foodSearchLimiter, ip);
    if (!rl.success) {
      return rateLimitExceededResponse(rl.reset);
    }

    const { searchParams } = new URL(request.url);
    const foodId = searchParams.get('id');

    if (!foodId) {
      return NextResponse.json({ error: 'Food ID required' }, { status: 400 });
    }

    const food = await getFood(foodId);
    return NextResponse.json({ food });
  } catch (error) {
    logger.error('Food details error:', error);
    return NextResponse.json({ error: 'Food not found' }, { status: 404 });
  }
}
