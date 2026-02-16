import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/safe-logger';
import { JobResultSchema } from '@/lib/schemas/plan';
import { createNewRedisConnection } from '@/lib/redis';
import { AGENT_MESSAGES, formatSSE } from './stream-constants';
import { handleDatabasePolling } from './job-poller';

/** SSE connection timeout: 10 minutes max for plan generation */
const SSE_TIMEOUT_MS = 10 * 60 * 1000;

/** Heartbeat interval to prevent proxy/CDN disconnects */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/**
 * Handle SSE streaming via Redis pub/sub.
 * Subscribes to job-specific channel for real-time progress updates from the worker.
 */
export async function handleRedisPubSub(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  jobId: string,
  request: NextRequest,
  send: (data: Record<string, unknown>) => void
): Promise<void> {
  const subscriber = createNewRedisConnection();
  const channel = `job:${jobId}:progress`;
  let lastAgent = 0;
  let isCleanedUp = false;

  let heartbeatInterval: NodeJS.Timeout | null = null;

  const cleanup = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    try {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    } catch {
      // Ignore cleanup errors
    }
  };

  // Get initial state from DB and send current progress
  const initialJob = await prisma.planGenerationJob.findUnique({
    where: { id: jobId },
    select: { status: true, currentAgent: true, error: true, result: true },
  });

  if (initialJob) {
    lastAgent = initialJob.currentAgent || 0;
    for (let i = 1; i <= lastAgent; i++) {
      const agent = AGENT_MESSAGES[i];
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
    await cleanup();
    await handleDatabasePolling(controller, jobId, request, send);
    return;
  }

  // Start heartbeat to prevent proxy/CDN disconnects
  heartbeatInterval = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(': heartbeat\n\n'));
    } catch {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Timeout after SSE_TIMEOUT_MS
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
          const agentInfo = AGENT_MESSAGES[i];
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
          agentName: AGENT_MESSAGES[6].name,
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

      // For intermediate 'saving' progress
      if (progress.status === 'saving') {
        send({
          status: 'running',
          agent: 6,
          agentName: AGENT_MESSAGES[6].name,
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

// Re-export formatSSE for the route handler
export { formatSSE };
