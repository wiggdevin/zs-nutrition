/**
 * Redis-backed L2 cache implementing ExternalFoodCache.
 * Wraps an IORedis-compatible client with get/setex operations.
 * Used by FatSecretAdapter and USDAAdapter for cross-process cache sharing.
 */

import type { ExternalFoodCache } from './food-data-types';

/** Minimal subset of IORedis used by this cache — avoids hard dependency on ioredis types. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
}

export class RedisFoodCache implements ExternalFoodCache {
  private redis: RedisLike;

  constructor(redis: RedisLike) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }
}
