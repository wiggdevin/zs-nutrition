// ============================================================
// Sync Activity Data from Fitness Platforms
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';
import { syncUserActivity } from '@/lib/fitness/scheduler';

/**
 * POST /api/fitness/sync
 *
 * Manually trigger activity data sync from connected platforms
 */
export async function POST(req: NextRequest) {
  try {
    let dbUserId: string;
    try {
      ({ dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const userId = dbUserId;

    const body = await req.json();
    const { platform, date } = body;

    // Get all active connections for user
    const connections = await prisma.fitnessConnection.findMany({
      where: {
        userId,
        isActive: true,
        ...(platform && { platform }), // Filter by platform if specified
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No connected fitness platforms found' }, { status: 404 });
    }

    const syncDate = date ? new Date(date) : new Date();

    // Manual sync always forces (bypasses frequency check)
    await syncUserActivity(userId, connections, { force: true });

    return NextResponse.json({
      success: true,
      syncDate: syncDate.toISOString().split('T')[0],
      platforms: connections.map((c: any) => c.platform),
    });
  } catch (error) {
    logger.error('Error in fitness sync:', error);
    return NextResponse.json({ error: 'Failed to sync activity data' }, { status: 500 });
  }
}
