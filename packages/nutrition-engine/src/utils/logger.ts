const isDev = process.env.NODE_ENV !== 'production';

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
 *   fallback activations, or degraded responses.
 * - `error` -- Always logged. Use for unrecoverable failures such as agent
 *   crashes, missing required data, or fatal API errors.
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
    console.warn('[NutritionEngine:WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[NutritionEngine:ERROR]', ...args);
  },
};
