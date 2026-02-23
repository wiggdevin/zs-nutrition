import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '@zsn/queue-config';
import { logger } from './logger.js';

export { QUEUE_NAMES } from '@zsn/queue-config';

/**
 * Redis connection configuration.
 * Supports REDIS_URL (Upstash/Railway format) or individual REDIS_HOST/PORT/PASSWORD.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.error('REDIS_URL is required for the queue worker');
    process.exit(1);
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

/**
 * Create the plan-generation queue instance.
 * Use this from the web app to enqueue jobs.
 */
export function createPlanGenerationQueue(connection: IORedis): Queue {
  return new Queue(QUEUE_NAMES.PLAN_GENERATION, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
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
      removeOnComplete: {
        age: 30 * 24 * 3600, // 30 days
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // 30 days
      },
    },
  });
}
