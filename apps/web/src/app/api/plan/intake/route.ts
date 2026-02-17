import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDevMode } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { decompressJson } from '@/lib/compression';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/plan/intake?jobId=xxx
 *
 * Called by the BullMQ worker to fetch intakeData for a job.
 * Reference-based jobs (P4-T06): worker only has jobId, fetches data via HTTP.
 * Protected by INTERNAL_API_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret =
    process.env.INTERNAL_API_SECRET || (isDevMode ? 'dev-internal-secret' : null);

  if (!expectedSecret) {
    logger.error('[/api/plan/intake] INTERNAL_API_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!authHeader || !safeCompare(authHeader, `Bearer ${expectedSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  // P5-T03: Optional draftId for fast-path draft retrieval
  const draftId = request.nextUrl.searchParams.get('draftId');

  try {
    const job = await prisma.planGenerationJob.findUnique({
      where: { id: jobId },
      select: { intakeData: true, status: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If draftId is provided (fast-path), also fetch the draft from the existing plan
    let draftData: unknown = null;
    if (draftId) {
      const existingPlan = await prisma.mealPlan.findUnique({
        where: { id: draftId },
        select: { draftData: true },
      });
      draftData = existingPlan?.draftData ? decompressJson(existingPlan.draftData) : null;
      if (!draftData) {
        logger.warn(`[/api/plan/intake] No draft data found for plan ${draftId}`);
      }
    }

    // Decompress intakeData (handles both compressed and raw formats transparently)
    const intakeData = decompressJson(job.intakeData);

    return NextResponse.json({
      intakeData,
      ...(draftData ? { draftData } : {}),
    });
  } catch (error) {
    logger.error('[/api/plan/intake] Error fetching intake data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
