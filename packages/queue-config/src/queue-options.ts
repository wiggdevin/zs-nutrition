/**
 * Shared job options for BullMQ queues.
 * Previously duplicated between apps/web/src/lib/queue.ts and
 * workers/queue-processor/src/queues.ts with a "keep in sync" comment.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 3600, // keep completed jobs for 24 hours
    count: 100,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // keep failed jobs for 7 days
  },
} as const;

/**
 * Job data interface for plan generation jobs.
 */
export interface PlanGenerationJobData {
  jobId: string;
  userId: string;
  intakeData: Record<string, unknown>;
}
