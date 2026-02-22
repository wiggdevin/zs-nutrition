import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/safe-logger';
import { decompressJson } from '@/lib/compression';
import { safeCompare } from '@/lib/safe-compare';

/**
 * GET /api/plan/intake?jobId=xxx
 *
 * Called by the BullMQ worker to fetch intakeData for a job.
 * Reference-based jobs (P4-T06): worker only has jobId, fetches data via HTTP.
 * Protected by INTERNAL_API_SECRET.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  if (!expectedSecret) {
    logger.error('[/api/plan/intake] INTERNAL_API_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !safeCompare(token, expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info(
    `[AUDIT] ${new Date().toISOString()} ${request.method} /api/plan/intake from ${request.headers.get('x-forwarded-for') || 'unknown'}`
  );

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
