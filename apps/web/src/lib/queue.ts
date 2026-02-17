import { Queue } from 'bullmq';
import { createNewRedisConnection } from './redis';
import { logger } from '@/lib/safe-logger';
import { PLAN_GENERATION_QUEUE, DEFAULT_JOB_OPTIONS } from '@zsn/queue-config';
import type { PlanGenerationJobData } from '@zsn/shared-types';

export type { PlanGenerationJobData } from '@zsn/shared-types';
export { PLAN_GENERATION_QUEUE } from '@zsn/queue-config';

const globalForQueue = globalThis as unknown as {
  planGenerationQueue: Queue | MockQueue | undefined;
};

/**
 * Mock queue for development when Redis is not available.
 * Logs the job data to console instead of enqueuing to Redis.
 */
class MockQueue {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  async add(jobName: string, data: PlanGenerationJobData, opts?: { jobId?: string }) {
    logger.debug(`[MockQueue] Job enqueued: ${jobName}`, {
      queueName: this.name,
      jobId: opts?.jobId || data.jobId,
      pipelinePath: data.pipelinePath,
    });
    return {
      id: opts?.jobId || data.jobId,
      name: jobName,
      data,
    };
  }
}

function createQueue(): Queue | MockQueue {
  const useMock = process.env.USE_MOCK_QUEUE === 'true';

  if (useMock) {
    logger.info('[Queue] Using MockQueue (USE_MOCK_QUEUE=true)');
    return new MockQueue(PLAN_GENERATION_QUEUE);
  }

  return new Queue(PLAN_GENERATION_QUEUE, {
    connection: createNewRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export const planGenerationQueue = globalForQueue.planGenerationQueue ?? createQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.planGenerationQueue = planGenerationQueue;
}
