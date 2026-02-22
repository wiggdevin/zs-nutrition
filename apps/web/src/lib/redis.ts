import IORedis from 'ioredis';
import { logger } from '@/lib/safe-logger';

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined;
};

function createRedisConnection() {
  // When using mock queue, don't create a real Redis connection
  if (process.env.USE_MOCK_QUEUE === 'true') {
    return new IORedis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: () => null, // Don't retry in mock mode
    });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'REDIS_URL is required in production. Set it in your Vercel environment variables.'
      );
    }
  }

  if (process.env.NODE_ENV === 'production' && redisUrl && !redisUrl.startsWith('rediss://')) {
    throw new Error('REDIS_URL must use TLS (rediss://) in production');
  }

  if (!redisUrl) {
    logger.warn('REDIS_URL not configured, using lazy Redis connection for development');
    return new IORedis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });
  }
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

export const redis = globalForRedis.redis ?? createRedisConnection();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export function createNewRedisConnection() {
  return createRedisConnection();
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
