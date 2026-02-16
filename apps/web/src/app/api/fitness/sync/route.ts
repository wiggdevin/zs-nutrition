// ============================================================
// Sync Activity Data from Fitness Platforms
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * POST /api/fitness/sync
 *
 * Manually trigger activity data sync from connected platforms
 */
export async function POST(req: NextRequest) {
  try {
    let clerkUserId: string;
    let _dbUserId: string;
    try {
      ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    // Use clerkUserId as userId for fitness queries (fitness tables store Clerk user IDs)
    const userId = clerkUserId;

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
    const results: any[] = [];

    // Sync from each platform
    for (const connection of connections) {
      try {
        const syncResult = await syncFromPlatform(connection, syncDate);
        results.push(syncResult);
      } catch (error) {
        logger.error(`Error syncing from ${connection.platform}:`, error);
        results.push({
          platform: connection.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      syncDate: syncDate.toISOString().split('T')[0],
      results,
    });
  } catch (error) {
    logger.error('Error in fitness sync:', error);
    return NextResponse.json({ error: 'Failed to sync activity data' }, { status: 500 });
  }
}

/**
 * Sync activity data from a specific platform
 */
async function syncFromPlatform(
  connection: any,
  syncDate: Date
): Promise<{
  platform: string;
  success: boolean;
  data?: any;
  error?: string;
}> {
  const platform = connection.platform;
  const accessToken = connection.accessToken;

  switch (platform) {
    case 'fitbit':
      return await syncFitbitData(accessToken, syncDate);

    case 'oura':
      return await syncOuraData(accessToken, syncDate);

    case 'google_fit':
      return await syncGoogleFitData(accessToken, syncDate);

    case 'apple_health':
      // Apple HealthKit requires native iOS integration
      // This would be called from the mobile app
      return {
        platform: 'apple_health',
        success: false,
        error: 'Apple HealthKit requires native iOS app integration',
      };

    default:
      return {
        platform,
        success: false,
        error: 'Unsupported platform',
      };
  }
}

/**
 * Sync data from Fitbit
 */
async function syncFitbitData(accessToken: string, syncDate: Date): Promise<any> {
  const dateStr = syncDate.toISOString().split('T')[0];

  // Fetch activity data
  const activityResponse = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${dateStr}.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!activityResponse.ok) {
    throw new Error(`Fitbit API error: ${activityResponse.statusText}`);
  }

  const activityData: any = await activityResponse.json();

  // Fetch sleep data
  const sleepResponse = await fetch(
    `https://api.fitbit.com/1.2/user/-/sleep/date/${dateStr}.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let sleepData: any = null;
  if (sleepResponse.ok) {
    sleepData = await sleepResponse.json();
  }

  // Store or update activity sync
  // Note: In production, you would normalize this data first
  // using the normalizer functions from normalizer.ts

  return {
    platform: 'fitbit',
    success: true,
    data: {
      activity: activityData.summary,
      sleep: sleepData?.summary || null,
    },
  };
}

/**
 * Sync data from Oura
 */
async function syncOuraData(accessToken: string, syncDate: Date): Promise<any> {
  const dateStr = syncDate.toISOString().split('T')[0];

  // Fetch activity data
  const activityResponse = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${dateStr}&end_date=${dateStr}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!activityResponse.ok) {
    throw new Error(`Oura API error: ${activityResponse.statusText}`);
  }

  const activityData = await activityResponse.json();

  // Fetch sleep data
  const sleepResponse = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${dateStr}&end_date=${dateStr}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let sleepData: any = null;
  if (sleepResponse.ok) {
    sleepData = await sleepResponse.json();
  }

  return {
    platform: 'oura',
    success: true,
    data: {
      activity: activityData.data?.[0] || null,
      sleep: sleepData.data?.[0] || null,
    },
  };
}

/**
 * Sync data from Google Fit
 */
async function syncGoogleFitData(accessToken: string, syncDate: Date): Promise<any> {
  const startTime = new Date(syncDate);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(syncDate);
  endTime.setHours(23, 59, 59, 999);

  const startTimeNanos = BigInt(startTime.getTime()) * BigInt(1000000);
  const endTimeNanos = BigInt(endTime.getTime()) * BigInt(1000000);

  // Fetch steps data
  const stepsResponse = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          {
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId:
              'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
          },
        ],
        bucketByTime: { durationMillis: 86400000 }, // 1 day
        startTimeNs: startTimeNanos.toString(),
        endTimeNs: endTimeNanos.toString(),
      }),
    }
  );

  if (!stepsResponse.ok) {
    throw new Error(`Google Fit API error: ${stepsResponse.statusText}`);
  }

  const stepsData = await stepsResponse.json();

  return {
    platform: 'google_fit',
    success: true,
    data: {
      steps: stepsData.bucket?.[0] || null,
    },
  };
}
