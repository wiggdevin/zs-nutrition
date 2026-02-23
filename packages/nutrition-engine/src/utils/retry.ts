import { engineLogger } from './logger';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404];

/** Extract a numeric HTTP status code from an unknown error object. */
function getStatusCode(error: unknown): number | undefined {
  if (error !== null && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const code = err['status'] ?? err['statusCode'];
    if (typeof code === 'number') return code;
  }
  return undefined;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;

      const statusCode = getStatusCode(error);
      if (statusCode !== undefined && NON_RETRYABLE_STATUS_CODES.includes(statusCode)) {
        throw error;
      }

      if (attempt === options.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        options.maxDelay
      );

      const message = error instanceof Error ? error.message : String(error);
      engineLogger.warn(
        `[Retry] Attempt ${attempt + 1}/${options.maxRetries} failed, ` +
          `retrying in ${Math.round(delay)}ms: ${message}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
