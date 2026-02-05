import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser, isDevMode } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { JobResultSchema } from '@/lib/schemas/plan';
import { createNewRedisConnection } from '@/lib/redis';

/** SSE connection timeout: 5 minutes max for plan generation */
const SSE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * SSE endpoint for streaming plan generation progress.
 *
 * Client connects to /api/plan-stream/[jobId] and receives real-time progress events.
 * Each event is a JSON object with:
 *   - status: 'pending' | 'running' | 'completed' | 'failed'
 *   - agent: current agent number (1-6)
 *   - message: human-readable progress message
 *   - planId: (only on 'completed') the generated plan ID
 *
 * In production mode, uses Redis pub/sub for real-time updates from the worker.
 * In dev mode (USE_MOCK_QUEUE=true), simulates agent progression locally.
 */

const agentMessages: Record<number, { name: string; message: string }> = {
  1: { name: 'Intake Normalizer', message: 'Cleaning and validating your data...' },
  2: { name: 'Metabolic Calculator', message: 'Calculating BMR, TDEE, and macro targets...' },
  3: { name: 'Recipe Curator', message: 'AI generating meal ideas matching your targets...' },
  4: { name: 'Nutrition Compiler', message: 'Verifying nutrition data via FatSecret...' },
  5: { name: 'QA Validator', message: 'Enforcing calorie and macro tolerances...' },
  6: { name: 'Brand Renderer', message: 'Generating your deliverables...' },
};

function formatSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Determine whether to use Redis pub/sub for SSE streaming.
 * Returns true in production when REDIS_URL is configured.
 */
function shouldUseRedisPubSub(): boolean {
  // Dev mode or mock queue uses simulation
  if (isDevMode || process.env.USE_MOCK_QUEUE === 'true') {
    return false;
  }
  // Production requires REDIS_URL
  return !!process.env.REDIS_URL;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Auth check
  let clerkUserId: string;
  try {
    ({ clerkUserId } = await requireActiveUser());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Account is deactivated' ? 403 : 401;
    return new Response(message, { status });
  }

  // Verify job exists and belongs to user
  // Use select to only fetch needed fields for status checking
  const job = await prisma.planGenerationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      currentAgent: true,
      progress: true,
      error: true,
      result: true,
      user: { select: { clerkUserId: true } },
      // Excluded: intakeData, completedAt, startedAt, createdAt (not needed for SSE)
    },
  });

  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  if (job.user.clerkUserId !== clerkUserId) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(data)));
        } catch {
          // Stream may be closed
        }
      };

      // Check if already completed or failed
      if (job.status === 'completed') {
        // result is now a Prisma Json type - validate with schema
        const result = JobResultSchema.safeParse(job.result).success
          ? (job.result as { planId?: string })
          : {};
        // Send all agents as complete, then final event
        for (let i = 1; i <= 6; i++) {
          send({
            status: 'running',
            agent: i,
            agentName: agentMessages[i].name,
            message: `Agent ${i} complete`,
          });
        }
        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId: result.planId || null,
        });
        controller.close();
        return;
      }

      if (job.status === 'failed') {
        send({
          status: 'failed',
          agent: job.currentAgent || 0,
          message: job.error || 'Plan generation failed',
        });
        controller.close();
        return;
      }

      // For dev mode with mock queue: the plan is generated synchronously
      // in the generate endpoint, so simulate the pipeline progression via SSE
      if (isDevMode || process.env.USE_MOCK_QUEUE === 'true') {
        // Simulate agent pipeline progression
        for (let agentNum = 1; agentNum <= 6; agentNum++) {
          // Check if client disconnected
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          const agent = agentMessages[agentNum];
          send({
            status: 'running',
            agent: agentNum,
            agentName: agent.name,
            message: agent.message,
          });

          // Update the job's currentAgent in the database
          // progress is now a Prisma Json type - pass object directly
          try {
            await prisma.planGenerationJob.update({
              where: { id: jobId },
              data: {
                status: 'running',
                currentAgent: agentNum,
                progress: {
                  agent: agentNum,
                  agentName: agent.name,
                  message: agent.message,
                  timestamp: new Date().toISOString(),
                },
                ...(agentNum === 1 ? { startedAt: new Date() } : {}),
              },
            });
          } catch {
            // Non-blocking - continue even if DB update fails
          }

          // Wait between agents (simulating work)
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Check for the completed plan - only fetch needed fields
        const completedJob = await prisma.planGenerationJob.findUnique({
          where: { id: jobId },
          select: {
            status: true,
            result: true,
          },
        });

        // result is now a Prisma Json type - validate with schema
        const result = JobResultSchema.safeParse(completedJob?.result).success
          ? (completedJob?.result as { planId?: string })
          : {};
        const planId = result.planId || null;

        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId,
        });

        controller.close();
        return;
      }

      // Production mode: Use Redis pub/sub for real-time updates from worker
      if (shouldUseRedisPubSub()) {
        await handleRedisPubSub(controller, encoder, jobId, request, send);
        return;
      }

      // Fallback: poll job status from database (legacy behavior)
      await handleDatabasePolling(controller, jobId, request, send);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Handle SSE streaming via Redis pub/sub.
 * Subscribes to job-specific channel for real-time progress updates from the worker.
 */
async function handleRedisPubSub(
  controller: ReadableStreamDefaultController,
  _encoder: TextEncoder,
  jobId: string,
  request: NextRequest,
  send: (data: Record<string, unknown>) => void
): Promise<void> {
  const subscriber = createNewRedisConnection();
  const channel = `job:${jobId}:progress`;
  let lastAgent = 0;
  let isCleanedUp = false;

  const cleanup = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    } catch {
      // Ignore cleanup errors
    }
  };

  // Get initial state from DB (single query) and send current progress
  const initialJob = await prisma.planGenerationJob.findUnique({
    where: { id: jobId },
    select: { status: true, currentAgent: true, error: true, result: true },
  });

  if (initialJob) {
    lastAgent = initialJob.currentAgent || 0;
    // Send current progress for agents already processed
    for (let i = 1; i <= lastAgent; i++) {
      const agent = agentMessages[i];
      if (agent) {
        send({
          status: 'running',
          agent: i,
          agentName: agent.name,
          message: agent.message,
        });
      }
    }
  }

  // Subscribe to real-time updates
  try {
    await subscriber.subscribe(channel);
    logger.debug(`[SSE] Subscribed to Redis channel: ${channel}`);
  } catch (err) {
    logger.error('[SSE] Failed to subscribe to Redis channel:', err);
    // Fall back to database polling
    await cleanup();
    await handleDatabasePolling(controller, jobId, request, send);
    return;
  }

  // Timeout after 5 minutes - declared before message handler so it can be cleared on completion
  const timeout = setTimeout(async () => {
    logger.warn(`[SSE] Timeout waiting for job ${jobId}`);
    send({
      status: 'failed',
      agent: lastAgent,
      message: 'Plan generation timed out',
    });
    await cleanup();
    controller.close();
  }, SSE_TIMEOUT_MS);

  // Handle incoming messages
  subscriber.on('message', async (receivedChannel: string, message: string) => {
    if (receivedChannel !== channel) return;

    try {
      const progress = JSON.parse(message) as {
        status?: string;
        agent?: number;
        agentName?: string;
        message?: string;
        error?: string;
        planId?: string;
      };

      // Send agent progress updates for any new agents
      const currentAgent = progress.agent || 0;
      if (currentAgent > lastAgent) {
        for (let i = lastAgent + 1; i <= currentAgent; i++) {
          const agentInfo = agentMessages[i];
          if (agentInfo) {
            send({
              status: 'running',
              agent: i,
              agentName: agentInfo.name,
              message: agentInfo.message,
            });
          }
        }
        lastAgent = currentAgent;
      }

      // Handle terminal states
      if (progress.status === 'completed') {
        // Fetch the completed job to get planId
        const completedJob = await prisma.planGenerationJob.findUnique({
          where: { id: jobId },
          select: { result: true },
        });
        const result = JobResultSchema.safeParse(completedJob?.result).success
          ? (completedJob?.result as { planId?: string })
          : {};

        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId: result.planId || progress.planId || null,
        });
        clearTimeout(timeout);
        await cleanup();
        controller.close();
        return;
      }

      if (progress.status === 'failed') {
        send({
          status: 'failed',
          agent: currentAgent,
          message: progress.error || progress.message || 'Plan generation failed',
        });
        clearTimeout(timeout);
        await cleanup();
        controller.close();
        return;
      }

      // For intermediate progress, send the update if status is 'saving'
      if (progress.status === 'saving') {
        send({
          status: 'running',
          agent: 6,
          agentName: agentMessages[6].name,
          message: progress.message || 'Saving your meal plan...',
        });
      }
    } catch (err) {
      logger.error('[SSE] Error processing Redis message:', err);
    }
  });

  // Handle subscriber errors
  subscriber.on('error', (err) => {
    logger.error('[SSE] Redis subscriber error:', err);
  });

  // Cleanup on client disconnect
  request.signal.addEventListener('abort', async () => {
    clearTimeout(timeout);
    await cleanup();
    try {
      controller.close();
    } catch {
      // Stream may already be closed
    }
  });
}

/**
 * Handle SSE streaming via database polling.
 * This is the legacy fallback when Redis pub/sub is not available.
 */
async function handleDatabasePolling(
  controller: ReadableStreamDefaultController,
  jobId: string,
  request: NextRequest,
  send: (data: Record<string, unknown>) => void
): Promise<void> {
  let lastAgent = 0;
  const maxPolls = 120; // 2 minutes max at 1s intervals
  let pollCount = 0;

  while (pollCount < maxPolls) {
    if (request.signal.aborted) {
      controller.close();
      return;
    }

    pollCount++;
    try {
      // Use select to only fetch needed fields for status polling
      const currentJob = await prisma.planGenerationJob.findUnique({
        where: { id: jobId },
        select: {
          status: true,
          currentAgent: true,
          error: true,
          result: true,
          // Excluded: intakeData, progress (large JSON blobs not needed for status)
        },
      });

      if (!currentJob) {
        send({ status: 'failed', agent: 0, message: 'Job not found' });
        controller.close();
        return;
      }

      const currentAgent = currentJob.currentAgent || 0;

      // Send progress update if agent changed
      if (currentAgent > lastAgent) {
        for (let i = lastAgent + 1; i <= currentAgent; i++) {
          const agent = agentMessages[i];
          if (agent) {
            send({
              status: 'running',
              agent: i,
              agentName: agent.name,
              message: agent.message,
            });
          }
        }
        lastAgent = currentAgent;
      }

      // Check terminal states
      if (currentJob.status === 'completed') {
        // result is now a Prisma Json type - validate with schema
        const result = JobResultSchema.safeParse(currentJob.result).success
          ? (currentJob.result as { planId?: string })
          : {};
        send({
          status: 'completed',
          agent: 6,
          agentName: agentMessages[6].name,
          message: 'Plan generation complete!',
          planId: result.planId || null,
        });
        controller.close();
        return;
      }

      if (currentJob.status === 'failed') {
        send({
          status: 'failed',
          agent: currentAgent,
          message: currentJob.error || 'Plan generation failed',
        });
        controller.close();
        return;
      }
    } catch (err) {
      logger.error('[plan-stream] Poll error:', err);
    }

    // Wait 1 second between polls
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Timeout
  send({
    status: 'failed',
    agent: lastAgent,
    message: 'Plan generation timed out',
  });
  controller.close();
}
