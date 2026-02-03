import IORedis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined
}

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
    })
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('REDIS_URL not configured, using lazy Redis connection for development')
    return new IORedis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: () => null,
    })
  }
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export const redis =
  globalForRedis.redis ?? createRedisConnection()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

export function createNewRedisConnection() {
  return createRedisConnection()
}
