import { redis } from '@/lib/redis';
import { logger } from '@/lib/safe-logger';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    logger.warn('[Cache] GET failed:', err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('[Cache] SET failed:', err);
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.warn('[Cache] DEL failed:', err);
  }
}

// Key generators
export const CacheKeys = {
  userProfile: (userId: string) => `cache:profile:${userId}`,
  activePlan: (userId: string) => `cache:plan:${userId}`,
  dailySummary: (userId: string, date: string) => `cache:daily:${userId}:${date}`,
  foodSearch: (source: string, query: string) => `cache:food:${source}:${query}`,
  foodDetail: (source: string, foodId: string) => `cache:food-detail:${source}:${foodId}`,
};
