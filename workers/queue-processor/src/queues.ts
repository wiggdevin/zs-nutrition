import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Redis connection configuration.
 * Supports REDIS_URL (Upstash/Railway format) or individual REDIS_HOST/PORT/PASSWORD.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.error('[Worker] REDIS_URL is required for the queue worker. The worker cannot function without Redis.');
    process.exit(1);
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

/**
 * Queue name constants
 */
export const QUEUE_NAMES = {
  PLAN_GENERATION: 'plan-generation',
  DEAD_LETTER: 'dead-letter',
} as const;

// IMPORTANT: Keep in sync with apps/web/src/lib/queue.ts
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

/**
 * Create the dead-letter queue instance.
 * Jobs that exhaust all retry attempts are moved here for investigation.
 */
export function createDeadLetterQueue(connection: IORedis): Queue {
  return new Queue(QUEUE_NAMES.DEAD_LETTER, {
    connection,
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}
