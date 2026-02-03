import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Redis connection configuration.
 * Supports REDIS_URL (Upstash/Railway format) or individual REDIS_HOST/PORT/PASSWORD.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      // Upstash requires TLS
      ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
    });
  }

  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Queue name constants
 */
export const QUEUE_NAMES = {
  PLAN_GENERATION: 'plan-generation',
} as const;

/**
 * Default queue options shared across all queues.
 */
export const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
    },
  },
};

/**
 * Create the plan-generation queue instance.
 * Use this from the web app to enqueue jobs.
 */
export function createPlanGenerationQueue(connection: IORedis): Queue {
  return new Queue(QUEUE_NAMES.PLAN_GENERATION, {
    connection,
    ...defaultQueueOptions,
  });
}
