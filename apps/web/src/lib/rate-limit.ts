/**
 * Rate limiting utility using a sliding window algorithm.
 *
 * In production, this would use Upstash Redis (@upstash/ratelimit).
 * For development/when Redis is unavailable, uses an in-memory store.
 *
 * Rate limits are applied per-user (by clerkUserId), not globally.
 */

import { NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Human-readable identifier for the rate limit (used in headers/errors) */
  identifier: string;
}

// In-memory store for rate limiting (per-process)
// In production, this would be replaced by Upstash Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval - remove expired entries every 5 minutes
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries where all timestamps are older than 1 hour
      const validTimestamps = entry.timestamps.filter(t => now - t < 3600000);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        entry.timestamps = validTimestamps;
      }
    }
  }, 300000); // Every 5 minutes
}

/**
 * Check rate limit for a given user and endpoint.
 * Uses sliding window algorithm.
 *
 * @returns { success: boolean, limit, remaining, reset }
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} {
  ensureCleanup();

  const key = `ratelimit:${config.identifier}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  // Check if under limit
  if (entry.timestamps.length >= config.limit) {
    // Rate limited - calculate when the oldest request in window expires
    const oldestInWindow = Math.min(...entry.timestamps);
    const reset = oldestInWindow + config.windowMs;

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: Math.ceil((reset - now) / 1000), // seconds until reset
    };
  }

  // Under limit - record this request
  entry.timestamps.push(now);

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.timestamps.length,
    reset: Math.ceil(config.windowMs / 1000), // seconds in window
  };
}

/**
 * Pre-configured rate limits for AI endpoints
 */
export const RATE_LIMITS = {
  planGeneration: {
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    identifier: 'plan-generation',
  } satisfies RateLimitConfig,

  mealSwap: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    identifier: 'meal-swap',
  } satisfies RateLimitConfig,
} as const;

/**
 * Add rate limit headers to a NextResponse.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: { limit: number; remaining: number; reset: number }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));
  return response;
}

/**
 * Create a rate-limited error response with proper headers.
 */
export function rateLimitExceededResponse(
  result: { limit: number; remaining: number; reset: number },
  config: RateLimitConfig
): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: `You have exceeded the maximum of ${config.limit} requests per hour for ${config.identifier.replace(/-/g, ' ')}. Please try again in ${result.reset} seconds.`,
      retryAfter: result.reset,
    },
    { status: 429 }
  );

  addRateLimitHeaders(response, result);
  response.headers.set('Retry-After', String(result.reset));

  return response;
}

/**
 * Reset rate limit for a specific user and endpoint (useful for testing).
 */
export function resetRateLimit(userId: string, identifier: string): void {
  const key = `ratelimit:${identifier}:${userId}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for a user without consuming a request.
 */
export function getRateLimitStatus(
  userId: string,
  config: RateLimitConfig
): {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
} {
  const key = `ratelimit:${config.identifier}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const entry = rateLimitStore.get(key);
  const validTimestamps = entry
    ? entry.timestamps.filter(t => t > windowStart)
    : [];

  return {
    limit: config.limit,
    remaining: Math.max(0, config.limit - validTimestamps.length),
    used: validTimestamps.length,
    reset: Math.ceil(config.windowMs / 1000),
  };
}
