// ============================================================
// Trigger Background Sync for All Users (Admin/Cron Only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { syncAllUserActivity } from '@/lib/fitness/scheduler';

/**
 * POST /api/fitness/sync-all
 *
 * Trigger background sync for all users with active fitness connections
 * This should be called by a cron job or background worker
 *
 * Note: In production, this should be protected with authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Simple API key check (in production, use proper authentication)
    const authHeader = req.headers.get('authorization');
    const cronKey = process.env.CRON_SECRET_KEY || 'dev-cron-key';

    if (authHeader !== `Bearer ${cronKey}`) {
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
    console.error('Error in fitness sync-all:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
