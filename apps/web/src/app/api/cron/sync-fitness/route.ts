import { NextResponse } from 'next/server';
import { syncAllUserActivity } from '@/lib/fitness/scheduler';
import { logger } from '@/lib/safe-logger';
import { safeCompare } from '@/lib/safe-compare';

/**
 * GET /api/cron/sync-fitness
 * Vercel Cron Job: Syncs activity data for all users with active fitness connections.
 * Runs at 10 AM and 3 PM UTC.
 */
export async function GET(request: Request) {
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
    const result = await syncAllUserActivity();

    logger.info('Fitness sync cron completed', {
      usersSynced: result.usersSynced,
      connectionsSynced: result.connectionsSynced,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      usersSynced: result.usersSynced,
      connectionsSynced: result.connectionsSynced,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Fitness sync cron failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
