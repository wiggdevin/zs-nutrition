import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new Redis({ url, token });
  }
  return undefined;
}

const redis = createRedis();

if (process.env.NODE_ENV === 'production' && !redis) {
  console.error(
    '⚠️ CRITICAL: Upstash Redis not configured in production — all rate limiting is DISABLED'
  );
}

// General API: 60 requests per minute
export const generalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'ratelimit:general',
    })
  : null;

// Plan generation: 5 per hour (expensive AI calls)
export const planGenerationLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
      prefix: 'ratelimit:plan',
    })
  : null;

// Vision analysis: 20 per hour
export const visionLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      analytics: true,
      prefix: 'ratelimit:vision',
    })
  : null;

// Food search: 100 per minute
export const foodSearchLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:food',
    })
  : null;

// Meal swap: 10 per hour
export const mealSwapLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:swap',
    })
  : null;

// Chat messages: 30 per hour
export const chatLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      analytics: true,
      prefix: 'ratelimit:chat',
    })
  : null;

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!limiter) {
    console.warn(
      `[rate-limit] Limiter unavailable for ${identifier}, denying request (Redis offline?)`
    );
    return { success: false };
  }
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining, reset: result.reset };
}

export function rateLimitExceededResponse(reset?: number) {
  const retryAfter = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60;
  return new Response(
    JSON.stringify({ error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
