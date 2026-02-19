// ============================================================
// Manage Fitness Platform Connections
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/fitness/connections
 *
 * Get list of connected fitness platforms for user
 */
export async function GET(_req: NextRequest) {
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

    const connections = await prisma.fitnessConnection.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Don't expose access tokens in response
    const sanitizedConnections = connections.map((conn: any) => ({
      platform: conn.platform,
      platformUserId: conn.platformUserId,
      lastSyncAt: conn.lastSyncAt,
      syncFrequency: conn.syncFrequency,
      settings: conn.settings,
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({
      connections: sanitizedConnections,
    });
  } catch (error) {
    logger.error('Error fetching fitness connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

/**
 * DELETE /api/fitness/connections
 *
 * Disconnect a fitness platform
 */
export async function DELETE(req: NextRequest) {
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

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Deactivate the connection (soft delete)
    await prisma.fitnessConnection.updateMany({
      where: {
        userId,
        platform,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${platform} disconnected successfully`,
    });
  } catch (error) {
    logger.error('Error disconnecting fitness platform:', error);
    return NextResponse.json({ error: 'Failed to disconnect platform' }, { status: 500 });
  }
}

/**
 * PATCH /api/fitness/connections
 *
 * Update connection settings (sync frequency, etc.)
 */
export async function PATCH(req: NextRequest) {
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
    const { platform, syncFrequency, settings } = body;

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Update connection
    const updated = await prisma.fitnessConnection.updateMany({
      where: {
        userId,
        platform,
        isActive: true,
      },
      data: {
        ...(syncFrequency && { syncFrequency }),
        ...(settings && { settings: JSON.stringify(settings) }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection updated successfully',
    });
  } catch (error) {
    logger.error('Error updating fitness connection:', error);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
}
