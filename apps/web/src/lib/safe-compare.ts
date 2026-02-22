import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Timing-safe string comparison using HMAC to avoid length leaking.
 * Use this for all secret/token comparisons.
 */
export function safeCompare(a: string, b: string): boolean {
  const hmac1 = createHmac('sha256', 'zsn-internal').update(a).digest();
  const hmac2 = createHmac('sha256', 'zsn-internal').update(b).digest();
  return timingSafeEqual(hmac1, hmac2);
}
