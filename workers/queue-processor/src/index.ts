import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { NutritionPipelineOrchestrator, PipelineConfig } from '@zero-sum/nutrition-engine';
import { createRedisConnection, QUEUE_NAMES, createDeadLetterQueue } from './queues.js';
import IORedis from 'ioredis';

/**
 * Redis publisher for SSE progress streaming.
 * Publishing progress to Redis pub/sub allows the web app's SSE endpoint
 * to receive real-time updates without polling the database.
 */
function createRedisPublisher(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('[Worker] REDIS_URL is required for pub/sub. Progress streaming disabled.');
    // Return a dummy publisher that no-ops on publish
    return new IORedis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
  }
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

// Dedicated publisher connection for pub/sub (separate from BullMQ connection)
const publisher = createRedisPublisher();

// Handle publisher errors to prevent unhandled rejections
publisher.on('error', (err) => {
  console.error('[Worker] Redis publisher error:', err.message);
  // Don't crash - progress updates will fail silently and SSE falls back to polling
});

/**
 * Publish progress update to Redis pub/sub channel for real-time SSE streaming.
 * Channel format: job:{jobId}:progress
 */
async function publishProgress(jobId: string, progress: Record<string, unknown>): Promise<void> {
  try {
    const channel = `job:${jobId}:progress`;
    const message = JSON.stringify({
      ...progress,
      jobId,
      timestamp: Date.now(),
    });
    await publisher.publish(channel, message);
  } catch (err) {
    // Non-fatal: SSE can fall back to database polling if pub/sub fails
    console.warn('[Worker] Failed to publish progress to Redis:', safeError(err));
  }
}

/** Extract safe error message without PII or stack traces */
function safeError(err: unknown): string {
  if (err instanceof Error)
    return `${err.name}: ${err.message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')}`;
  if (typeof err === 'string')
    return err.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]');
  return 'Unknown error';
}

/**
 * BullMQ Queue Processor Worker
 * Processes plan generation jobs by running the nutrition pipeline.
 * Deployed on Railway separately from the Next.js app.
 */

async function saveToWebApp(
  webAppUrl: string,
  jobId: string,
  planData: unknown,
  metabolicProfile: unknown,
  secret: string,
  maxRetries = 3
): Promise<{ planId: string }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${webAppUrl}/api/plan/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ jobId, planData, metabolicProfile }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed (status: ${response.status}): ${errorText}`);
      }

      return (await response.json()) as { planId: string };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(safeError(err));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(
          `⚠️ Save attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay / 1000}s: ${safeError(err)}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('Failed to save plan after all retries');
}

const config: PipelineConfig = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  fatsecretClientId: process.env.FATSECRET_CLIENT_ID || '',
  fatsecretClientSecret: process.env.FATSECRET_CLIENT_SECRET || '',
  usdaApiKey: process.env.USDA_API_KEY || undefined,
};

async function startWorker() {
  console.log('🚀 Starting ZS-MAC Queue Processor...');
  console.log(`📋 Listening on queue: ${QUEUE_NAMES.PLAN_GENERATION}`);

  const connection = createRedisConnection();

  // Test Redis connectivity
  try {
    const pong = await connection.ping();
    console.log(`🔗 Redis connected: ${pong}`);
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', safeError(err));
    process.exit(1);
  }

  // Dead letter queue for jobs that exhaust all retry attempts
  const deadLetterQueue = createDeadLetterQueue(connection);
  console.log(`🪦 Dead letter queue ready: ${QUEUE_NAMES.DEAD_LETTER}`);

  const orchestrator = new NutritionPipelineOrchestrator(config);

  const worker = new Worker(
    QUEUE_NAMES.PLAN_GENERATION,
    async (job: Job) => {
      console.log(`📦 Processing job ${job.id}: ${job.name}`);

      const { intakeData, jobId } = job.data;

      try {
        // Update job progress and publish to Redis for real-time SSE streaming
        const initialProgress = { status: 'running', agent: 1 };
        await job.updateProgress(initialProgress);
        await publishProgress(jobId, initialProgress);

        const result = await orchestrator.run(intakeData, async (progress) => {
          await job.updateProgress(progress);
          // Spread progress first, then override status to ensure 'running' is set
          await publishProgress(jobId, { ...progress, status: 'running' });
          console.log(`  Agent ${progress.agent} (${progress.agentName}): ${progress.message}`);
        });

        if (!result.success) {
          throw new Error(result.error || 'Pipeline failed');
        }

        console.log(`✅ Job ${job.id} completed successfully`);

        // Save the completed plan to the database via the web app's API endpoint
        const savingProgress = { status: 'saving', message: 'Saving your meal plan...' };
        await job.updateProgress(savingProgress);
        await publishProgress(jobId, savingProgress);

        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3456';
        const secret = process.env.INTERNAL_API_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('INTERNAL_API_SECRET is required in production.');
        }
        const resolvedSecret = secret || 'dev-internal-secret';
        const saveData = await saveToWebApp(
          webAppUrl,
          jobId,
          result.plan,
          (result.deliverables as Record<string, unknown>)?.metabolicProfile || {},
          resolvedSecret
        );
        console.log(`💾 Plan saved to database: ${saveData.planId}`);

        return { planData: result.plan, deliverables: result.deliverables };
      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, safeError(error));
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', async (job) => {
    console.log(`✅ Job ${job?.id} completed`);
    // Publish completion event for SSE subscribers
    if (job?.data?.jobId) {
      await publishProgress(job.data.jobId, {
        status: 'completed',
        message: 'Plan generation complete!',
      });
    }
  });

  worker.on('failed', async (job, err) => {
    if (!job) {
      console.error('❌ Unknown job failed:', err.message);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;

    if (attemptsMade >= maxAttempts) {
      // Job exhausted all retries — move to dead letter queue
      console.error(
        `💀 Job ${job.id} permanently failed after ${attemptsMade}/${maxAttempts} attempts: ${err.message}`
      );

      // Publish failure event for SSE subscribers (only on final failure)
      if (job.data?.jobId) {
        await publishProgress(job.data.jobId, {
          status: 'failed',
          error: safeError(err),
          message: 'Plan generation failed after all retries',
        });
      }

      try {
        await deadLetterQueue.add(
          `dlq:${job.name}`,
          {
            originalJobId: job.id,
            originalQueue: QUEUE_NAMES.PLAN_GENERATION,
            originalData: job.data,
            failedReason: err.message,
            attemptsMade,
            failedAt: new Date().toISOString(),
          },
          { jobId: `dlq-${job.id}` }
        );
        console.log(`🪦 Job ${job.id} moved to dead letter queue`);
      } catch (dlqErr) {
        console.error(`❌ Failed to move job ${job.id} to DLQ:`, safeError(dlqErr));
      }
    } else {
      console.warn(
        `⚠️ Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}), will retry: ${err.message}`
      );
    }
  });

  worker.on('error', (err) => {
    console.error('Worker error:', safeError(err));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', safeError(reason));
  });

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', safeError(error));
    await worker.close();
    await deadLetterQueue.close();
    await publisher.quit();
    await connection.quit();
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down worker...');
    await worker.close();
    await deadLetterQueue.close();
    await publisher.quit();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('✅ Worker is running and waiting for jobs...');
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', safeError(err));
  process.exit(1);
});
