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
        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
        try {
          const saveResponse = await fetch(`${webAppUrl}/api/plan/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET || ''}`,
            },
            body: JSON.stringify({
              jobId,
              planData: result.plan,
              metabolicProfile: (result.deliverables as Record<string, unknown>)?.metabolicProfile || {},
            }),
          });

          if (saveResponse.ok) {
            const saveData = await saveResponse.json() as { planId: string };
            console.log(`💾 Plan saved to database: ${saveData.planId}`);
          } else {
            const errorText = await saveResponse.text();
            console.error(`⚠️ Failed to save plan to database (status: ${saveResponse.status})`);
          }
        } catch (saveError) {
          console.error(`⚠️ Error calling /api/plan/complete:`, safeError(saveError));
          // Non-fatal: the job itself succeeded, plan data is in the return value
        }

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
