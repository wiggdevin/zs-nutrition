import { Queue } from 'bullmq'
import { createNewRedisConnection } from './redis'

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
    console.log(`[MockQueue] Job enqueued: ${jobName}`, {
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
    console.log('[Queue] Using MockQueue (USE_MOCK_QUEUE=true)')
    return new MockQueue(PLAN_GENERATION_QUEUE)
  }

  return new Queue(PLAN_GENERATION_QUEUE, {
    connection: createNewRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  })
}

export const planGenerationQueue =
  globalForQueue.planGenerationQueue ?? createQueue()

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.planGenerationQueue = planGenerationQueue
}
