import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/safe-logger';
import { JobResultSchema } from '@/lib/schemas/plan';
import { AGENT_MESSAGES } from './stream-constants';

/**
 * Handle SSE streaming via database polling.
 * This is the legacy fallback when Redis pub/sub is not available.
 */
export async function handleDatabasePolling(
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
      const currentJob = await prisma.planGenerationJob.findUnique({
        where: { id: jobId },
        select: {
          status: true,
          currentAgent: true,
          error: true,
          result: true,
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
        lastAgent = currentAgent;
      }

      // Check terminal states
      if (currentJob.status === 'completed') {
        const result = JobResultSchema.safeParse(currentJob.result).success
          ? (currentJob.result as { planId?: string })
          : {};
        send({
          status: 'completed',
          agent: 6,
          agentName: AGENT_MESSAGES[6].name,
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
