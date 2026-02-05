import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { NutritionPipelineOrchestrator, PipelineConfig } from '@zero-sum/nutrition-engine';
import { createRedisConnection, QUEUE_NAMES } from './queues.js';

/** Extract safe error message without PII or stack traces */
function safeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')}`;
  if (typeof err === 'string') return err.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]');
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
  maxRetries = 3,
): Promise<{ planId: string }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${webAppUrl}/api/plan/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ jobId, planData, metabolicProfile }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed (status: ${response.status}): ${errorText}`);
      }

      return await response.json() as { planId: string };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(safeError(err));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`⚠️ Save attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay / 1000}s: ${safeError(err)}`);
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

  const orchestrator = new NutritionPipelineOrchestrator(config);

  const worker = new Worker(
    QUEUE_NAMES.PLAN_GENERATION,
    async (job: Job) => {
      console.log(`📦 Processing job ${job.id}: ${job.name}`);

      const { intakeData, jobId } = job.data;

      try {
        // Update job progress
        await job.updateProgress({ status: 'running', agent: 1 });

        const result = await orchestrator.run(intakeData, async (progress) => {
          await job.updateProgress(progress);
          console.log(`  Agent ${progress.agent} (${progress.agentName}): ${progress.message}`);
        });

        if (!result.success) {
          throw new Error(result.error || 'Pipeline failed');
        }

        console.log(`✅ Job ${job.id} completed successfully`);

        // Save the completed plan to the database via the web app's API endpoint
        await job.updateProgress({ status: 'saving', message: 'Saving your meal plan...' });

        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
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
          resolvedSecret,
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

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job?.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', safeError(err));
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down worker...');
    await worker.close();
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
