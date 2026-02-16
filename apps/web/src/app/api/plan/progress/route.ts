import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDevMode } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface ProgressBody {
  jobId: string;
  agent?: number;
  agentName?: string;
  message?: string;
  status?: 'running' | 'failed';
  error?: string;
}

/**
 * POST /api/plan/progress
 *
 * Called by the BullMQ worker to report agent progress during plan generation.
 * Protected by INTERNAL_API_SECRET Bearer token (same pattern as /api/plan/complete).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret =
    process.env.INTERNAL_API_SECRET || (isDevMode ? 'dev-internal-secret' : null);

  if (!expectedSecret) {
    logger.error('[/api/plan/progress] INTERNAL_API_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!authHeader || !safeCompare(authHeader, `Bearer ${expectedSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let body: ProgressBody;
    try {
      body = (await request.json()) as ProgressBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await prisma.planGenerationJob.findUnique({
      where: { id: body.jobId },
      select: { id: true, status: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Don't update already-completed or already-failed jobs
    if (job.status === 'completed' || job.status === 'failed') {
      return NextResponse.json({ success: true, skipped: true });
    }

    if (body.status === 'failed') {
      await prisma.planGenerationJob.update({
        where: { id: body.jobId },
        data: {
          status: 'failed',
          error: body.error || body.message || 'Plan generation failed',
          currentAgent: body.agent ?? undefined,
          completedAt: new Date(),
        },
      });
    } else {
      // Running / progress update
      const updateData: Record<string, unknown> = {
        status: 'running',
        currentAgent: body.agent ?? undefined,
        progress: {
          agent: body.agent,
          agentName: body.agentName,
          message: body.message,
        },
      };

      // Set startedAt on the first progress update (agent 1)
      if (body.agent === 1) {
        updateData.startedAt = new Date();
      }

      await prisma.planGenerationJob.update({
        where: { id: body.jobId },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[/api/plan/progress] Error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
