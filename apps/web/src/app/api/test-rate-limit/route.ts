import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';
import {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitExceededResponse,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
} from '@/lib/rate-limit';

/**
 * GET /api/test-rate-limit
 *
 * Test endpoint to verify rate limiting works correctly.
 * Query params:
 *   - endpoint: 'plan-generation' | 'meal-swap' (which rate limit to test)
 *   - action: 'check' | 'status' | 'reset' (default: 'check')
 *
 * 'check' - Consumes a rate limit token and returns result
 * 'status' - Returns current status without consuming
 * 'reset' - Resets the rate limit for this user/endpoint
 */
export async function GET(req: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'plan-generation';
    const action = searchParams.get('action') || 'check';

    // Select the rate limit config
    const config = endpoint === 'meal-swap'
      ? RATE_LIMITS.mealSwap
      : RATE_LIMITS.planGeneration;

    if (action === 'reset') {
      resetRateLimit(clerkUserId, config.identifier);
      return NextResponse.json({
        success: true,
        message: `Rate limit reset for ${config.identifier}`,
        userId: clerkUserId,
      });
    }

    if (action === 'status') {
      const status = getRateLimitStatus(clerkUserId, config);
      const response = NextResponse.json({
        success: true,
        endpoint: config.identifier,
        userId: clerkUserId,
        ...status,
      });
      response.headers.set('X-RateLimit-Limit', String(status.limit));
      response.headers.set('X-RateLimit-Remaining', String(status.remaining));
      response.headers.set('X-RateLimit-Reset', String(status.reset));
      return response;
    }

    // action === 'check' - consume a rate limit token
    const result = checkRateLimit(clerkUserId, config);

    if (!result.success) {
      return rateLimitExceededResponse(result, config);
    }

    const response = NextResponse.json({
      success: true,
      endpoint: config.identifier,
      userId: clerkUserId,
      message: `Request allowed. ${result.remaining} requests remaining.`,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    });
    addRateLimitHeaders(response, result);
    return response;
  } catch (error) {
    safeLogError('Rate limit test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
