import { Queue } from 'bullmq'
import { createNewRedisConnection } from './redis'
import { logger } from '@/lib/safe-logger'

const globalForQueue = globalThis as unknown as {
  planGenerationQueue: Queue | MockQueue | undefined
}

export const PLAN_GENERATION_QUEUE = 'plan-generation'

export interface PlanGenerationJobData {
  jobId: string
  userId: string
  intakeData: Record<string, unknown>
}

/**
 * Mock queue for development when Redis is not available.
 * Logs the job data to console instead of enqueuing to Redis.
 */
class MockQueue {
  name: string
  constructor(name: string) {
    this.name = name
  }
  async add(jobName: string, data: PlanGenerationJobData, opts?: { jobId?: string }) {
    logger.debug(`[MockQueue] Job enqueued: ${jobName}`, {
      queueName: this.name,
      jobId: opts?.jobId || data.jobId,
      intakeDataKeys: Object.keys(data.intakeData),
    })
    return {
      id: opts?.jobId || data.jobId,
      name: jobName,
      data,
    }
  }
}

function createQueue(): Queue | MockQueue {
  const useMock = process.env.USE_MOCK_QUEUE === 'true'

  if (useMock) {
    logger.info('[Queue] Using MockQueue (USE_MOCK_QUEUE=true)')
    return new MockQueue(PLAN_GENERATION_QUEUE)
  }

  return new Queue(PLAN_GENERATION_QUEUE, {
    connection: createNewRedisConnection(),
    // IMPORTANT: Keep in sync with workers/queue-processor/src/queues.ts
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
  })
}

export const planGenerationQueue =
  globalForQueue.planGenerationQueue ?? createQueue()

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.planGenerationQueue = planGenerationQueue
}
