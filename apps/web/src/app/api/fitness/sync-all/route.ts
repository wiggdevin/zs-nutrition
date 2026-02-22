// ============================================================
// Trigger Background Sync for All Users (Admin/Cron Only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { syncAllUserActivity } from '@/lib/fitness/scheduler';
import { logger } from '@/lib/safe-logger';
import { safeCompare } from '@/lib/safe-compare';

/**
 * POST /api/fitness/sync-all
 *
 * Trigger background sync for all users with active fitness connections
 * This should be called by a cron job or background worker
 *
 * Protected by CRON_SECRET Bearer token.
 */
export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || !safeCompare(token, cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncAllUserActivity();

    return NextResponse.json({
      success: result.success,
      usersSynced: result.usersSynced,
      connectionsSynced: result.connectionsSynced,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in fitness sync-all:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
