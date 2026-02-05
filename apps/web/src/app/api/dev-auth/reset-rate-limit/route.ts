import { NextResponse } from 'next/server';
import { getClerkUserId } from '@/lib/auth';
import { planGenerationLimiter } from '@/lib/rate-limit';

/**
 * Development-only endpoint to reset rate limits for testing.
 * With Upstash rate limiting, limits are managed server-side via Redis TTLs.
 * This endpoint now resets by calling the limiter's resetUsedTokens method.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (planGenerationLimiter) {
      await planGenerationLimiter.resetUsedTokens(clerkUserId);
    }

    return NextResponse.json({
      success: true,
      message: 'Rate limit reset for plan generation',
      userId: clerkUserId
    });
  } catch (error) {
    console.error('Reset rate limit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
