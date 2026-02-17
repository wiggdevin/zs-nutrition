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
 *
 * P5-T05: Aligned with @zsn/shared-types (reference-based, no PII in Redis).
 * The canonical type lives in @zsn/shared-types — this re-export exists
 * for packages that depend on @zsn/queue-config but not shared-types.
 */
export interface PlanGenerationJobData {
  jobId: string;
  pipelinePath: 'full' | 'fast';
  existingDraftId?: string;
}
