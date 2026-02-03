import { NextResponse } from 'next/server';
import { getClerkUserId } from '@/lib/auth';
import { resetRateLimit } from '@/lib/rate-limit';

/**
 * Development-only endpoint to reset rate limits for testing.
 * This allows developers to test rate limiting without waiting for the window to expire.
 */
export async function POST() {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset rate limit for plan generation
    resetRateLimit(clerkUserId, 'plan-generation');

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
