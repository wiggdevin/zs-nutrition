const isDev = process.env.NODE_ENV !== 'production';

/**
 * Redact PII from log arguments at warn/error level.
 * Strips emails, API keys, database URLs, and Redis URLs from strings and Error messages.
 */
function redactPII(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return arg
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
        .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[API_KEY_REDACTED]')
        .replace(/sk_(test|live)_[a-zA-Z0-9]+/g, '[CLERK_KEY_REDACTED]')
        .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN_REDACTED]')
        .replace(/postgresql:\/\/[^\s"']+/g, '[DB_URL_REDACTED]')
        .replace(/rediss?:\/\/[^\s"']+/g, '[REDIS_URL_REDACTED]');
    }
    if (arg instanceof Error) {
      return arg.message
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
        .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[API_KEY_REDACTED]')
        .replace(/postgresql:\/\/[^\s"']+/g, '[DB_URL_REDACTED]')
        .replace(/rediss?:\/\/[^\s"']+/g, '[REDIS_URL_REDACTED]');
    }
    return arg;
  });
}

/**
 * Structured logger for the nutrition-engine package.
 *
 * All messages are automatically prefixed with `[NutritionEngine]` (or a
 * severity-specific variant) so they are easy to filter in aggregated logs.
 *
 * **Log-level behavior:**
 *
 * - `debug` -- Dev-only, suppressed in production. Use for detailed pipeline
 *   tracing (e.g., intermediate agent inputs/outputs, token counts).
 * - `info` -- Dev-only, suppressed in production. Use for agent lifecycle
 *   events (e.g., agent started, agent completed).
 * - `warn` -- Always logged. Use for recoverable issues such as API retries,
 *   fallback activations, or degraded responses. PII is redacted.
 * - `error` -- Always logged. Use for unrecoverable failures such as agent
 *   crashes, missing required data, or fatal API errors. PII is redacted.
 */
export const engineLogger = {
  debug: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log('[NutritionEngine]', ...args);
  },
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log('[NutritionEngine]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[NutritionEngine:WARN]', ...redactPII(args));
  },
  error: (...args: unknown[]) => {
    console.error('[NutritionEngine:ERROR]', ...redactPII(args));
  },
};
