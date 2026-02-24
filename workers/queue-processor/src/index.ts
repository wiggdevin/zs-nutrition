import { Worker, Job } from 'bullmq';
import {
  NutritionPipelineOrchestrator,
  PipelineConfig,
  RedisFoodCache,
  closeBrowserPool,
  type PipelineProgress,
} from '@zero-sum/nutrition-engine';
import { createRedisConnection, QUEUE_NAMES, createDeadLetterQueue } from './queues.js';
import IORedis from 'ioredis';
import type { PlanGenerationJobData } from '@zsn/shared-types';
import type { RawIntakeForm, MealPlanDraft } from '@zero-sum/nutrition-engine';
import { workerEnv } from './env.js';
import { PrismaClient } from '@prisma/client';
import { startDLQConsumer } from './dlq-consumer.js';
import { logger } from './logger.js';
import { safeError } from './utils.js';
import { startHealthServer, recordJobStart, recordJobEnd } from './health-server.js';

/**
 * Redis publisher for SSE progress streaming.
 * Publishing progress to Redis pub/sub allows the web app's SSE endpoint
 * to receive real-time updates without polling the database.
 */
function createRedisPublisher(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error('REDIS_URL not set, progress streaming disabled');
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
  logger.error('Redis publisher error', { error: err.message });
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
    logger.warn('Failed to publish progress to Redis', { error: safeError(err) });
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
        logger.warn('Save attempt failed, retrying', {
          attempt: attempt + 1,
          maxAttempts: maxRetries,
          retryDelaySeconds: delay / 1000,
          error: safeError(err),
        });
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
      logger.warn('Progress report failed', { status: response.status });
    }
  } catch (err) {
    logger.warn('Failed to report progress to web app', { error: safeError(err) });
  }
}

let _prisma: PrismaClient | undefined;

function getPrismaClient(): PrismaClient | undefined {
  const env = workerEnv();
  if (!env.DATABASE_URL) return undefined;
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// L2 food cache backed by Redis — shares the publisher connection (safe: no SUBSCRIBE mode)
const foodCache = new RedisFoodCache(publisher);

function buildPipelineConfig(): PipelineConfig {
  const env = workerEnv();
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    usdaApiKey: env.USDA_API_KEY,
    fatsecretClientId: env.FATSECRET_CLIENT_ID || undefined,
    fatsecretClientSecret: env.FATSECRET_CLIENT_SECRET || undefined,
    prismaClient: getPrismaClient(),
    externalFoodCache: foodCache,
  };
}

// Module-scope orchestrator singleton — FoodAliasCache loads once at startup
let _orchestrator: NutritionPipelineOrchestrator | undefined;

function getOrchestrator(): NutritionPipelineOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new NutritionPipelineOrchestrator(buildPipelineConfig());
  }
  return _orchestrator;
}

function validateEnvVars() {
  // P5-T05: Centralized validation via workerEnv() Zod schema
  // Throws with descriptive errors if required vars are missing
  const env = workerEnv();

  // Additional runtime warnings
  if (!env.DATABASE_URL) {
    logger.warn(
      'DATABASE_URL not set — LocalUSDAAdapter disabled, all food lookups will hit live USDA API'
    );
  }

  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://')) {
    logger.warn('REDIS_URL does not use TLS (rediss://), Upstash requires TLS');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && env.WEB_APP_URL.includes('localhost')) {
    logger.error('WEB_APP_URL points to localhost in production — worker callbacks will fail');
    process.exit(1);
  }

  logger.info('Environment variables validated');
}

async function startWorker() {
  logger.info('Starting ZS-MAC Queue Processor');

  // Validate env vars before doing anything else
  validateEnvVars();

  // Start health HTTP server for Railway HEALTHCHECK
  startHealthServer();

  logger.info('Listening on queue', { queue: QUEUE_NAMES.PLAN_GENERATION });

  const connection = createRedisConnection();

  // Test Redis connectivity
  try {
    const pong = await connection.ping();
    logger.info('Redis connected', { response: pong });
  } catch (err) {
    logger.error('Failed to connect to Redis', { error: safeError(err) });
    process.exit(1);
  }

  // P5-T04: Verify rate limiter / queue infrastructure on startup
  try {
    const infoRaw = await connection.info('clients');
    const connectedClients = infoRaw.match(/connected_clients:(\d+)/)?.[1] || 'unknown';
    logger.info('Redis rate limiter check passed', { connectedClients });
  } catch (err) {
    logger.error('Rate limiter health check failed', { error: safeError(err) });
    logger.error('Worker continuing in degraded mode — rate limiting may not function');
    // Do not exit: allow worker to operate in degraded mode
  }

  // Dead letter queue for jobs that exhaust all retry attempts
  const deadLetterQueue = createDeadLetterQueue(connection);
  logger.info('Dead letter queue ready', { queue: QUEUE_NAMES.DEAD_LETTER });

  // P5-T02: Start DLQ consumer to process permanently failed jobs
  const dlqWorker = startDLQConsumer(connection);

  // Initialize module-scope orchestrator (FoodAliasCache loads once)
  const orchestrator = getOrchestrator();

  const worker = new Worker(
    QUEUE_NAMES.PLAN_GENERATION,
    async (job: Job<PlanGenerationJobData>) => {
      logger.info('Processing job', { jobId: String(job.id), jobName: job.name });
      recordJobStart();

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
          logger.info('Agent progress', {
            agent: String(progress.agent),
            agentName: progress.agentName,
            message: progress.message,
            subStep: progress.subStep,
          });
        };

        // P5-T03: Run full or fast pipeline based on pipelinePath
        let result;
        if (pipelinePath === 'fast' && draftData) {
          logger.info('Running fast pipeline', { existingDraftId });
          result = await orchestrator.runFast(
            { rawInput: intakeData as RawIntakeForm, existingDraft: draftData as MealPlanDraft },
            onProgress
          );
        } else {
          if (pipelinePath === 'fast' && !draftData) {
            logger.warn(
              'Fast path requested but no draft available, falling back to full pipeline'
            );
          }
          result = await orchestrator.run(intakeData as RawIntakeForm, onProgress);
        }

        if (!result.success) {
          throw new Error(result.error || 'Pipeline failed');
        }

        logger.info('Job completed successfully', { jobId: String(job.id), pipelinePath });

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
        logger.info('Plan saved to database', { planId: saveData.planId });

        return { success: true, jobId: job.data.jobId };
      } catch (error) {
        logger.error('Job failed', { jobId: String(job.id), error: safeError(error) });
        if (error instanceof Error && error.stack) {
          logger.error('Error stack', { error: safeError({ message: error.stack }) });
        }
        throw error;
      } finally {
        recordJobEnd();
      }
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 300000, // 5 min — pipeline can take 75s+, default 30s causes stale lock errors
      closeTimeout: 180_000, // 3 min — allow in-flight jobs to finish before force-closing
    }
  );

  worker.on('completed', async (job) => {
    logger.info('Job completed', { jobId: String(job?.id) });
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
      logger.error('Unknown job failed', { error: safeError(err) });
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;

    if (attemptsMade >= maxAttempts) {
      // Job exhausted all retries — move to dead letter queue
      logger.error('Job permanently failed', {
        jobId: String(job.id),
        attemptsMade,
        maxAttempts,
        error: safeError(err),
      });

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
        logger.info('Job moved to dead letter queue', { jobId: String(job.id) });
      } catch (dlqErr) {
        logger.error('Failed to move job to DLQ', {
          jobId: String(job.id),
          error: safeError(dlqErr),
        });
      }
    } else {
      logger.warn('Job failed, will retry', {
        jobId: String(job.id),
        attemptsMade,
        maxAttempts,
        error: safeError(err),
      });
    }
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: safeError(err) });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { error: safeError(reason) });
  });

  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception', { error: safeError(error) });
    await worker.close();
    await dlqWorker.close();
    await deadLetterQueue.close();
    await publisher.quit();
    await connection.quit();
    process.exit(1);
  });

  // Graceful shutdown — drain jobs first, then release resources
  const shutdown = async () => {
    logger.info('Shutting down worker — draining active jobs');
    await worker.close(); // waits for in-flight jobs (up to closeTimeout)
    await dlqWorker.close();
    logger.info('Jobs drained, releasing resources');
    await closeBrowserPool();
    if (_prisma) await _prisma.$disconnect();
    await deadLetterQueue.close();
    await publisher.quit();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Worker is running and waiting for jobs');
}

startWorker().catch((err) => {
  logger.error('Failed to start worker', { error: safeError(err) });
  process.exit(1);
});
