import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { savePlanToDatabase, type PlanCompletionData } from '@/lib/save-plan';
import { prisma } from '@/lib/prisma';
import { isDevMode } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * POST /api/plan/complete
 *
 * Called by the BullMQ worker when a plan generation job completes successfully.
 * Protected by an internal API secret (INTERNAL_API_SECRET env var).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret =
    process.env.INTERNAL_API_SECRET || (isDevMode ? 'dev-internal-secret' : null);

  if (!expectedSecret) {
    logger.error('[/api/plan/complete] INTERNAL_API_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!authHeader || !safeCompare(authHeader, `Bearer ${expectedSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let body: PlanCompletionData;
    try {
      body = (await request.json()) as PlanCompletionData;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    if (!body.planData || !body.planData.days) {
      return NextResponse.json({ error: 'planData with days array is required' }, { status: 400 });
    }

    const job = await prisma.planGenerationJob.findUnique({
      where: { id: body.jobId },
      select: { id: true, status: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status === 'completed') {
      return NextResponse.json({ error: 'Job already completed' }, { status: 409 });
    }

    if (!['processing', 'running', 'pending'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot complete job in '${job.status}' state` },
        { status: 400 }
      );
    }

    const result = await savePlanToDatabase(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      planId: result.planId,
    });
  } catch (error) {
    logger.error('[/api/plan/complete] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
