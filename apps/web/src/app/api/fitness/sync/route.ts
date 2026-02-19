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
    const { platform } = body;

    // Get all active connections for user
    const connections = await prisma.fitnessConnection.findMany({
      where: {
        userId,
        isActive: true,
        ...(platform && { platform }),
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No connected fitness platforms found' }, { status: 404 });
    }

    // Count records before sync for diagnostics
    const beforeCount = await prisma.activitySync.count({
      where: { userId },
    });

    // Manual sync always forces (bypasses frequency check)
    let syncError: string | null = null;
    try {
      await syncUserActivity(userId, connections, { force: true });
    } catch (error) {
      syncError = error instanceof Error ? error.message : String(error);
      logger.error('Sync error (continuing to return diagnostics):', error);
    }

    // Count records after sync
    const afterCount = await prisma.activitySync.count({
      where: { userId },
    });

    // Get the most recent syncs to show what was stored
    const recentSyncs = await prisma.activitySync.findMany({
      where: { userId },
      orderBy: { syncDate: 'desc' },
      take: 14,
      select: {
        syncDate: true,
        platform: true,
        steps: true,
        activeCalories: true,
        sleepScore: true,
        readinessScore: true,
        hrvAvg: true,
      },
    });

    return NextResponse.json({
      success: !syncError,
      error: syncError,
      diagnostics: {
        recordsBefore: beforeCount,
        recordsAfter: afterCount,
        newRecords: afterCount - beforeCount,
        platforms: connections.map((c: any) => ({
          platform: c.platform,
          lastSyncAt: c.lastSyncAt,
        })),
        recentSyncs: recentSyncs.map((s) => ({
          date: s.syncDate.toISOString().split('T')[0],
          platform: s.platform,
          steps: s.steps,
          activeCalories: s.activeCalories,
          sleepScore: s.sleepScore,
          readinessScore: s.readinessScore,
          hrvAvg: s.hrvAvg,
        })),
      },
    });
  } catch (error) {
    logger.error('Error in fitness sync:', error);
    return NextResponse.json({ error: 'Failed to sync activity data' }, { status: 500 });
  }
}
