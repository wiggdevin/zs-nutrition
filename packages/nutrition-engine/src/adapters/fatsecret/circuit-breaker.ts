/**
 * Lightweight circuit breaker for FatSecret API calls.
 *
 * Prevents timeout cascades (up to 14 minutes observed) by fast-failing
 * when the API is consistently unresponsive. The breaker transitions
 * through three states:
 *
 *   CLOSED  --[failures >= threshold]--> OPEN
 *   OPEN    --[resetTimeout elapsed]---> HALF_OPEN
 *   HALF_OPEN --[success]--------------> CLOSED
 *   HALF_OPEN --[failure]--------------> OPEN
 *
 * A per-request timeout (default 10s) is enforced via Promise.race so
 * individual calls cannot block indefinitely.
 */

import { engineLogger } from '../../utils/logger';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = 'closed';

  constructor(
    /** Number of consecutive failures before the circuit opens */
    private readonly failureThreshold: number = 5,
    /** How long to wait (ms) before allowing a probe request in half-open state */
    private readonly resetTimeoutMs: number = 30_000,
    /** Per-request timeout (ms) enforced via Promise.race */
    private readonly requestTimeoutMs: number = 10_000
  ) {}

  /**
   * Execute a function through the circuit breaker.
   * Throws immediately if the circuit is open and the reset timeout has not elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half_open';
        engineLogger.info(
          '[FatSecret] Circuit breaker transitioning to HALF_OPEN -- allowing probe request'
        );
      } else {
        throw new Error('Circuit breaker is OPEN - FatSecret API unavailable');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('FatSecret API request timeout')),
            this.requestTimeoutMs
          )
        ),
      ]);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      engineLogger.info('[FatSecret] Circuit breaker CLOSED -- probe request succeeded');
    }
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      engineLogger.warn(
        `[FatSecret] Circuit breaker OPEN after ${this.failures} consecutive failures`
      );
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Module-level singleton shared across all FatSecret API calls.
 *
 * Configuration:
 *   - 5 failures to open
 *   - 30 s reset timeout before half-open probe
 *   - 10 s per-request timeout
 */
export const fatSecretCircuitBreaker = new CircuitBreaker(5, 30_000, 10_000);
