import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';
import {
  planGenerationLimiter,
  mealSwapLimiter,
  checkRateLimit,
  rateLimitExceededResponse,
} from '@/lib/rate-limit';

/**
 * GET /api/test-rate-limit — DEV ONLY
 *
 * Test endpoint to verify rate limiting works correctly.
 * Query params:
 *   - endpoint: 'plan-generation' | 'meal-swap' (which rate limit to test)
 *   - action: 'check' | 'reset' (default: 'check')
 *
 * 'check' - Consumes a rate limit token and returns result
 * 'reset' - Resets the rate limit for this user/endpoint
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'plan-generation';
    const action = searchParams.get('action') || 'check';

    const limiter = endpoint === 'meal-swap'
      ? mealSwapLimiter
      : planGenerationLimiter;

    if (!limiter) {
      return NextResponse.json({
        success: true,
        message: 'Rate limiting not configured (no Upstash Redis credentials)',
        userId: clerkUserId,
      });
    }

    if (action === 'reset') {
      await limiter.resetUsedTokens(clerkUserId);
      return NextResponse.json({
        success: true,
        message: `Rate limit reset for ${endpoint}`,
        userId: clerkUserId,
      });
    }

    // action === 'check' - consume a rate limit token
    const result = await checkRateLimit(limiter, clerkUserId);

    if (result && !result.success) {
      return rateLimitExceededResponse(result.reset);
    }

    return NextResponse.json({
      success: true,
      endpoint,
      userId: clerkUserId,
      message: `Request allowed. ${result?.remaining ?? 'unknown'} requests remaining.`,
      remaining: result?.remaining,
      reset: result?.reset,
    });
  } catch (error) {
    safeLogError('Rate limit test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
