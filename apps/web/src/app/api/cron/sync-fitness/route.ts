import { NextResponse } from 'next/server';
import { syncAllUserActivity } from '@/lib/fitness/scheduler';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/cron/sync-fitness
 * Vercel Cron Job: Syncs activity data for all users with active fitness connections.
 * Runs at 10 AM and 3 PM UTC.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
