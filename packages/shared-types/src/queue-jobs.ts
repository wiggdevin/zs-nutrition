/**
 * Queue job types shared between apps/web and workers/queue-processor.
 *
 * These define the data contracts for BullMQ job payloads.
 * Queue NAME constants live in @zsn/queue-config (Track B).
 *
 * P4-T06: Reference-based jobs — no PII in Redis.
 * intakeData is stored in the database only; the worker fetches it via HTTP.
 */

/**
 * Payload for a plan generation BullMQ job.
 * Produced by the web app when enqueuing, consumed by the queue-processor worker.
 *
 * Reference-based: contains only IDs and routing info, never user data.
 * The worker fetches intakeData from the web app via /api/plan/intake.
 */
export interface PlanGenerationJobData {
  jobId: string;
  pipelinePath: 'full' | 'fast';
  existingDraftId?: string;
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
  subStep?: string;
  error?: string;
  timestamp?: number;
}
