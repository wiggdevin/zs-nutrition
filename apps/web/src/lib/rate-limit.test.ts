import { describe, it, expect, vi, beforeEach } from 'vitest';

// The global setup.ts mocks @/lib/rate-limit. We need to unmock it and
// re-mock only the upstream dependencies (@upstash/*) so we can test
// the actual rate-limit module logic.
vi.unmock('@/lib/rate-limit');

const mockLimit = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow() {
      return {};
    }
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

// Import after mocks are set up
import { checkRateLimit, rateLimitExceededResponse } from './rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('returns success: false when limiter is null (Redis not configured)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await checkRateLimit(null, 'test-user');

      expect(result).toEqual({ success: false });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Limiter unavailable'));
      consoleSpy.mockRestore();
    });

    it('returns success and remaining from limiter when available', async () => {
      const resetTime = Date.now() + 60000;
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 59,
        reset: resetTime,
      });

      // Create a fake limiter object with a .limit method
      const fakeLimiter = { limit: mockLimit } as never;
      const result = await checkRateLimit(fakeLimiter, 'user-1');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(59);
      expect(result.reset).toBe(resetTime);
    });

    it('returns success: false when limiter denies request', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        reset: Date.now() + 30000,
      });

      const fakeLimiter = { limit: mockLimit } as never;
      const result = await checkRateLimit(fakeLimiter, 'user-2');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('rateLimitExceededResponse', () => {
    it('returns a 429 response', () => {
      const response = rateLimitExceededResponse();

      expect(response.status).toBe(429);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('includes Retry-After header defaulting to 60s when no reset provided', () => {
      const response = rateLimitExceededResponse();

      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('calculates Retry-After from reset timestamp', () => {
      const futureReset = Date.now() + 30000; // 30s in the future
      const response = rateLimitExceededResponse(futureReset);
      const retryAfter = Number(response.headers.get('Retry-After'));

      expect(retryAfter).toBeGreaterThanOrEqual(28);
      expect(retryAfter).toBeLessThanOrEqual(31);
    });

    it('returns minimum 1s Retry-After when reset is in the past', () => {
      const pastReset = Date.now() - 5000;
      const response = rateLimitExceededResponse(pastReset);

      expect(response.headers.get('Retry-After')).toBe('1');
    });

    it('body contains rate limit error message', async () => {
      const response = rateLimitExceededResponse();
      const body = await response.json();

      expect(body.error).toMatch(/rate limit exceeded/i);
    });
  });
});
