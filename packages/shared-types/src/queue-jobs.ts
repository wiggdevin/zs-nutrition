/**
 * Queue job types shared between apps/web and workers/queue-processor.
 *
 * These define the data contracts for BullMQ job payloads.
 * Queue NAME constants live in @zsn/queue-config (Track B).
 */

/**
 * Payload for a plan generation BullMQ job.
 * Produced by the web app when enqueuing, consumed by the queue-processor worker.
 */
export interface PlanGenerationJobData {
  jobId: string;
  userId: string;
  intakeData: Record<string, unknown>;
}

/**
 * Status of a plan generation job as stored in the database.
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Progress update published via Redis pub/sub for real-time SSE streaming.
 * The worker publishes these, and the web app's SSE endpoint forwards them to clients.
 */
export interface JobProgressUpdate {
  status: 'running' | 'saving' | 'completed' | 'failed';
  jobId?: string;
  agent?: number;
  agentName?: string;
  message?: string;
  error?: string;
  timestamp?: number;
}
