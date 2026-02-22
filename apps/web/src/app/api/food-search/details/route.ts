import { NextRequest, NextResponse } from 'next/server';
import { FatSecretAdapter } from '@zero-sum/nutrition-engine';
import { logger } from '@/lib/safe-logger';
import { requireActiveUser } from '@/lib/auth';
import { checkRateLimit, foodSearchLimiter, rateLimitExceededResponse } from '@/lib/rate-limit';

// Singleton FatSecret adapter instance
let fatSecretAdapter: FatSecretAdapter | null = null;

function getFatSecretAdapter(): FatSecretAdapter {
  if (!fatSecretAdapter) {
    fatSecretAdapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    );
  }
  return fatSecretAdapter;
}

/**
 * GET /api/food-search/details?id=local-1
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
    if (rl && !rl.success) {
      return rateLimitExceededResponse(rl.reset);
    }

    const { searchParams } = new URL(request.url);
    const foodId = searchParams.get('id');

    if (!foodId) {
      return NextResponse.json({ error: 'Food ID required' }, { status: 400 });
    }

    const fatSecret = getFatSecretAdapter();
    const food = await fatSecret.getFood(foodId);
    return NextResponse.json({ food });
  } catch (error) {
    logger.error('Food details error:', error);
    return NextResponse.json({ error: 'Food not found' }, { status: 404 });
  }
}
