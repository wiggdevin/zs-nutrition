/**
 * Structured logging for the AI Insights pipeline.
 * All log lines are prefixed with [INSIGHTS] for easy filtering.
 * Uses the project's safe-logger to respect ESLint no-console and redact PII.
 */

import { logger } from '@/lib/safe-logger';

const PREFIX = 'INSIGHTS';

export enum InsightsErrorCategory {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  CLAUDE_RATE_LIMIT = 'CLAUDE_RATE_LIMIT',
  CLAUDE_TIMEOUT = 'CLAUDE_TIMEOUT',
  CLAUDE_OVERLOADED = 'CLAUDE_OVERLOADED',
  CLAUDE_AUTH_ERROR = 'CLAUDE_AUTH_ERROR',
  RESPONSE_VALIDATION_FAILED = 'RESPONSE_VALIDATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_USER = 'RATE_LIMIT_USER',
}

export const insightsLogger = {
  aggregationStarted(window: number) {
    logger.info(`[${PREFIX}] Aggregation started | window: ${window} days`);
  },

  aggregationComplete(counts: {
    logs: number;
    meals: number;
    weights: number;
    swaps: number;
    durationMs: number;
  }) {
    logger.info(
      `[${PREFIX}] Aggregation complete | logs: ${counts.logs} | meals: ${counts.meals} | weights: ${counts.weights} | swaps: ${counts.swaps} | ${counts.durationMs}ms`
    );
  },

  cacheHit(hash: string, ageHours: number) {
    logger.info(
      `[${PREFIX}] Cache HIT | hash: ${hash.slice(0, 8)} | age: ${Math.round(ageHours)}h`
    );
  },

  cacheMiss() {
    logger.info(`[${PREFIX}] Cache MISS | generating fresh insights`);
  },

  claudeRequest(estTokens: number) {
    logger.info(`[${PREFIX}] Claude request | est_tokens: ${estTokens}`);
  },

  claudeResponse(stats: {
    inputTokens: number;
    outputTokens: number;
    recommendations: number;
    durationMs: number;
  }) {
    logger.info(
      `[${PREFIX}] Claude response | in: ${stats.inputTokens} | out: ${stats.outputTokens} | recs: ${stats.recommendations} | ${stats.durationMs}ms`
    );
  },

  claudeFailed(attempt: number, error: string) {
    logger.warn(`[${PREFIX}] Claude failed | attempt: ${attempt}`, error);
  },

  fallback(count: number) {
    logger.info(`[${PREFIX}] Fallback | generated ${count} deterministic insights`);
  },

  validationFailed(errors: string[]) {
    logger.warn(`[${PREFIX}] Validation failed`, JSON.stringify(errors));
  },

  rateLimitExceeded(userId: string, count: number) {
    logger.warn(
      `[${PREFIX}] Rate limit exceeded | userId: ${userId.slice(0, 8)}... | refreshes today: ${count}`
    );
  },

  pipelineComplete(durationMs: number, fromCache: boolean) {
    logger.info(
      `[${PREFIX}] Pipeline complete | ${durationMs}ms | ${fromCache ? 'cached' : 'fresh'}`
    );
  },
};

/**
 * Categorize an error into an InsightsErrorCategory for structured handling.
 */
export function categorizeError(error: unknown): InsightsErrorCategory {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('429'))
      return InsightsErrorCategory.CLAUDE_RATE_LIMIT;
    if (msg.includes('timeout') || msg.includes('timed out'))
      return InsightsErrorCategory.CLAUDE_TIMEOUT;
    if (msg.includes('overloaded') || msg.includes('529'))
      return InsightsErrorCategory.CLAUDE_OVERLOADED;
    if (msg.includes('401') || msg.includes('authentication') || msg.includes('api key'))
      return InsightsErrorCategory.CLAUDE_AUTH_ERROR;
  }
  return InsightsErrorCategory.DATABASE_ERROR;
}
