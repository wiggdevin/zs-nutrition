import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser, isDevMode } from '@/lib/auth';
import { JobResultSchema } from '@/lib/schemas/plan';
import {
  AGENT_MESSAGES,
  formatSSE,
  handleRedisPubSub,
  handleDatabasePolling,
} from '@/lib/plan-generation';

/**
 * Determine whether to use Redis pub/sub for SSE streaming.
 * Returns true in production when REDIS_URL is configured.
 */
function shouldUseRedisPubSub(): boolean {
  if (isDevMode || process.env.USE_MOCK_QUEUE === 'true') return false;
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
    },
  });

  if (!job) return new Response('Job not found', { status: 404 });
  if (job.user.clerkUserId !== clerkUserId) return new Response('Forbidden', { status: 403 });

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
        const result = JobResultSchema.safeParse(job.result).success
          ? (job.result as { planId?: string })
          : {};
        for (let i = 1; i <= 6; i++) {
          send({
            status: 'running',
            agent: i,
            agentName: AGENT_MESSAGES[i].name,
            message: `Agent ${i} complete`,
          });
        }
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

      if (job.status === 'failed') {
        send({
          status: 'failed',
          agent: job.currentAgent || 0,
          message: job.error || 'Plan generation failed',
        });
        controller.close();
        return;
      }

      // Dev mode: simulate agent pipeline progression
      if (isDevMode || process.env.USE_MOCK_QUEUE === 'true') {
        await simulateDevPipeline(controller, jobId, request, send);
        return;
      }

      // Production: Redis pub/sub
      if (shouldUseRedisPubSub()) {
        await handleRedisPubSub(controller, encoder, jobId, request, send);
        return;
      }

      // Fallback: database polling
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
 * Dev mode simulation: walk through agents with delays and update DB.
 */
async function simulateDevPipeline(
  controller: ReadableStreamDefaultController,
  jobId: string,
  request: NextRequest,
  send: (data: Record<string, unknown>) => void
) {
  for (let agentNum = 1; agentNum <= 6; agentNum++) {
    if (request.signal.aborted) {
      controller.close();
      return;
    }

    const agent = AGENT_MESSAGES[agentNum];
    send({
      status: 'running',
      agent: agentNum,
      agentName: agent.name,
      message: agent.message,
    });

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
      // Non-blocking
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Fetch completed plan
  const completedJob = await prisma.planGenerationJob.findUnique({
    where: { id: jobId },
    select: { status: true, result: true },
  });

  const result = JobResultSchema.safeParse(completedJob?.result).success
    ? (completedJob?.result as { planId?: string })
    : {};

  send({
    status: 'completed',
    agent: 6,
    agentName: AGENT_MESSAGES[6].name,
    message: 'Plan generation complete!',
    planId: result.planId || null,
  });

  controller.close();
}
