import { Worker, Job } from 'bullmq';
import {
  NutritionPipelineOrchestrator,
  PipelineConfig,
  closeBrowserPool,
  type PipelineProgress,
} from '@zero-sum/nutrition-engine';
import { createRedisConnection, QUEUE_NAMES, createDeadLetterQueue } from './queues.js';
import IORedis from 'ioredis';
import type { PlanGenerationJobData } from '@zsn/shared-types';
import type { RawIntakeForm, MealPlanDraft } from '@zero-sum/nutrition-engine';
import { workerEnv } from './env.js';
import { startDLQConsumer } from './dlq-consumer.js';

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

/**
 * Fetch intakeData (and optionally draftData) from the web app's database via HTTP (P4-T06).
 * Reference-based jobs: BullMQ job only has jobId, no PII in Redis.
 */
async function fetchIntakeData(
  webAppUrl: string,
  jobId: string,
  secret: string,
  existingDraftId?: string
): Promise<{ intakeData: Record<string, unknown>; draftData?: Record<string, unknown> }> {
  const url = new URL(`${webAppUrl}/api/plan/intake`);
  url.searchParams.set('jobId', jobId);
  if (existingDraftId) {
    url.searchParams.set('draftId', existingDraftId);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch intake data (status: ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    intakeData: Record<string, unknown>;
    draftData?: Record<string, unknown>;
  };
  if (!data.intakeData) {
    throw new Error(`No intake data found for job ${jobId}`);
  }

  return { intakeData: data.intakeData, draftData: data.draftData };
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
  draftData?: unknown,
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
        body: JSON.stringify({ jobId, planData, metabolicProfile, draftData }),
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

/**
 * Report progress to the web app's database via HTTP.
 * This ensures polling-based clients see real-time agent progress.
 * Fire-and-forget: failures are logged but don't block the pipeline.
 */
async function reportProgressToWebApp(
  webAppUrl: string,
  jobId: string,
  progress: Record<string, unknown>,
  secret: string
): Promise<void> {
  try {
    const response = await fetch(`${webAppUrl}/api/plan/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ jobId, ...progress }),
    });

    if (!response.ok) {
      console.warn(`[Worker] Progress report failed (status: ${response.status})`);
    }
  } catch (err) {
    console.warn('[Worker] Failed to report progress to web app:', safeError(err));
  }
}

function buildPipelineConfig(): PipelineConfig {
  const env = workerEnv();
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    fatsecretClientId: env.FATSECRET_CLIENT_ID,
    fatsecretClientSecret: env.FATSECRET_CLIENT_SECRET,
    usdaApiKey: env.USDA_API_KEY || undefined,
  };
}

function validateEnvVars() {
  // P5-T05: Centralized validation via workerEnv() Zod schema
  // Throws with descriptive errors if required vars are missing
  const env = workerEnv();

  // Additional runtime warnings
  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://')) {
    console.warn('⚠️  REDIS_URL does not use TLS (rediss://). Upstash requires TLS.');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && env.WEB_APP_URL.includes('localhost')) {
    console.error('❌ WEB_APP_URL points to localhost in production — worker callbacks will fail');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

async function startWorker() {
  console.log('🚀 Starting ZS-MAC Queue Processor...');

  // Validate env vars before doing anything else
  validateEnvVars();

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

  // P5-T04: Verify rate limiter / queue infrastructure on startup
  try {
    const infoRaw = await connection.info('clients');
    const connectedClients = infoRaw.match(/connected_clients:(\d+)/)?.[1] || 'unknown';
    console.log(`✅ Redis rate limiter check: ${connectedClients} connected client(s)`);
  } catch (err) {
    console.error(`🚨 CRITICAL: Rate limiter health check failed: ${safeError(err)}`);
    console.error('🚨 Worker continuing in degraded mode — rate limiting may not function');
    // Do not exit: allow worker to operate in degraded mode
  }

  // Dead letter queue for jobs that exhaust all retry attempts
  const deadLetterQueue = createDeadLetterQueue(connection);
  console.log(`🪦 Dead letter queue ready: ${QUEUE_NAMES.DEAD_LETTER}`);

  // P5-T02: Start DLQ consumer to process permanently failed jobs
  const dlqWorker = startDLQConsumer(connection);

  const orchestrator = new NutritionPipelineOrchestrator(buildPipelineConfig());

  const worker = new Worker(
    QUEUE_NAMES.PLAN_GENERATION,
    async (job: Job<PlanGenerationJobData>) => {
      console.log(`📦 Processing job ${job.id}: ${job.name}`);

      const { jobId, pipelinePath, existingDraftId } = job.data;

      const env = workerEnv();
      const webAppUrl = env.WEB_APP_URL;
      const resolvedSecret = env.INTERNAL_API_SECRET;

      try {
        // Update job progress and publish to Redis for real-time SSE streaming
        const initialProgress = {
          status: 'running',
          agent: 1,
          agentName: 'Intake Analyst',
          message: 'Starting pipeline...',
        };
        await job.updateProgress(initialProgress);
        await publishProgress(jobId, initialProgress);
        await reportProgressToWebApp(webAppUrl, jobId, initialProgress, resolvedSecret);

        // Fetch intakeData (and draft for fast-path) from web app
        const { intakeData, draftData } = await fetchIntakeData(
          webAppUrl,
          jobId,
          resolvedSecret,
          existingDraftId
        );

        const onProgress = async (progress: PipelineProgress) => {
          await job.updateProgress(progress);
          const progressWithStatus = { ...progress, status: 'running' as const };
          await publishProgress(jobId, progressWithStatus);
          await reportProgressToWebApp(webAppUrl, jobId, progressWithStatus, resolvedSecret);
          console.log(
            `  Agent ${progress.agent} (${progress.agentName}): ${progress.message}${progress.subStep ? ` [${progress.subStep}]` : ''}`
          );
        };

        // P5-T03: Run full or fast pipeline based on pipelinePath
        let result;
        if (pipelinePath === 'fast' && draftData) {
          console.log(`⚡ Running fast pipeline (reusing draft from plan ${existingDraftId})`);
          result = await orchestrator.runFast(
            { rawInput: intakeData as RawIntakeForm, existingDraft: draftData as MealPlanDraft },
            onProgress
          );
        } else {
          if (pipelinePath === 'fast' && !draftData) {
            console.warn(
              '⚠️ Fast path requested but no draft available, falling back to full pipeline'
            );
          }
          result = await orchestrator.run(intakeData as RawIntakeForm, onProgress);
        }

        if (!result.success) {
          throw new Error(result.error || 'Pipeline failed');
        }

        console.log(`✅ Job ${job.id} completed successfully (path: ${pipelinePath})`);

        // Save the completed plan to the database via the web app's API endpoint
        const savingProgress = { status: 'saving', message: 'Saving your meal plan...' };
        await job.updateProgress(savingProgress);
        await publishProgress(jobId, savingProgress);

        const saveData = await saveToWebApp(
          webAppUrl,
          jobId,
          result.plan,
          (result.deliverables as Record<string, unknown>)?.metabolicProfile || {},
          resolvedSecret,
          result.draft
        );
        console.log(`💾 Plan saved to database: ${saveData.planId}`);

        return { planData: result.plan, deliverables: result.deliverables };
      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, safeError(error));
        if (error instanceof Error) {
          console.error(`❌ Raw error stack:`, error.stack);
        }
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 300000, // 5 min — pipeline can take 75s+, default 30s causes stale lock errors
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
        const failureProgress = {
          status: 'failed',
          error: safeError(err),
          message: 'Plan generation failed after all retries',
        };
        await publishProgress(job.data.jobId, failureProgress);

        // Also report failure to DB so polling clients see it
        const failEnv = workerEnv();
        await reportProgressToWebApp(
          failEnv.WEB_APP_URL,
          job.data.jobId,
          failureProgress,
          failEnv.INTERNAL_API_SECRET
        );
      }

      try {
        await deadLetterQueue.add(
          `dlq:${job.name}`,
          {
            originalJobId: job.id,
            originalQueue: QUEUE_NAMES.PLAN_GENERATION,
            jobId: job.data?.jobId,
            failedReason: safeError(err),
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
    await dlqWorker.close();
    await deadLetterQueue.close();
    await publisher.quit();
    await connection.quit();
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down worker...');
    await closeBrowserPool();
    await worker.close();
    await dlqWorker.close();
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
