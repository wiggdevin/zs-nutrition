import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from './queues.js';
import { workerEnv } from './env.js';
import { logger } from './logger.js';
import { safeError } from './utils.js';

/**
 * DLQ job payload — matches what the main worker pushes to dead-letter queue.
 */
interface DLQJobData {
  originalJobId: string;
  originalQueue: string;
  jobId: string;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

/**
 * Send an admin alert for a permanently failed job.
 * Uses a webhook URL if configured; otherwise logs a CRITICAL message.
 */
async function sendAdminAlert(data: DLQJobData): Promise<void> {
  const webhookUrl = process.env.DLQ_ALERT_WEBHOOK_URL;

  const alertPayload = {
    text: `[ZS-MAC DLQ] Job permanently failed`,
    jobId: data.jobId,
    originalJobId: data.originalJobId,
    failedReason: safeError(data.failedReason),
    attemptsMade: data.attemptsMade,
    failedAt: data.failedAt,
  };

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload),
      });
      if (!response.ok) {
        logger.warn('Alert webhook returned non-OK status', { status: response.status });
      }
    } catch (err) {
      logger.error('Failed to send alert webhook', { error: safeError(err) });
    }
  } else {
    // No webhook configured — log at CRITICAL level for log aggregator to pick up
    logger.error('Job permanently failed — no alert webhook configured', {
      jobId: alertPayload.jobId,
      originalJobId: alertPayload.originalJobId,
      failedReason: alertPayload.failedReason,
      attemptsMade: alertPayload.attemptsMade,
      failedAt: alertPayload.failedAt,
    });
  }
}

/**
 * Start the Dead Letter Queue consumer.
 *
 * Processes jobs that exhausted all retries in the main plan-generation queue.
 * For each DLQ job:
 *   1. Logs PII-redacted failure metadata
 *   2. Sends admin alert (webhook or structured log)
 *   3. Job auto-removed after 30 days (removeOnComplete TTL)
 */
export function startDLQConsumer(connection: IORedis): Worker<DLQJobData> {
  const worker = new Worker<DLQJobData>(
    QUEUE_NAMES.DEAD_LETTER,
    async (job: Job<DLQJobData>) => {
      const { jobId, originalJobId, failedReason, attemptsMade, failedAt } = job.data;

      // Log PII-redacted failure info
      logger.error('Processing dead letter job', {
        jobId,
        originalJobId,
        failedReason: safeError(failedReason),
        attemptsMade,
        failedAt,
      });

      // Send admin alert
      await sendAdminAlert(job.data);

      // Optionally update job status in database via web app API
      try {
        const env = workerEnv();
        await fetch(`${env.WEB_APP_URL}/api/plan/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify({
            jobId,
            status: 'failed',
            error:
              'Plan generation permanently failed after all retries. Our team has been notified.',
          }),
        });
      } catch {
        // Non-fatal: DLQ processing should not fail because of API issues
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Processed dead letter job', { jobId: job?.data?.jobId || String(job?.id) });
  });

  worker.on('failed', (job, err) => {
    logger.error('Failed to process dead letter job', {
      jobId: String(job?.id),
      error: safeError(err),
    });
  });

  worker.on('error', (err) => {
    logger.error('DLQ worker error', { error: safeError(err) });
  });

  logger.info('DLQ consumer started', { queue: QUEUE_NAMES.DEAD_LETTER });
  return worker;
}
