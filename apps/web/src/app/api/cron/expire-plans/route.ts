import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/safe-logger';
import { safeCompare } from '@/lib/safe-compare';

/**
 * GET /api/cron/expire-plans
 * Vercel Cron Job: Expires meal plans whose endDate has passed.
 * Runs daily at 3 AM UTC.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await prisma.mealPlan.updateMany({
      where: {
        status: 'active',
        isActive: true,
        endDate: { lt: now },
      },
      data: {
        status: 'expired',
        isActive: false,
      },
    });

    logger.info(`[expire-plans] Expired ${result.count} meal plans`);
    return NextResponse.json({ success: true, expiredCount: result.count });
  } catch (error) {
    logger.error('[expire-plans] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
