// ============================================================
// Background Sync Scheduler for Fitness Platforms
// ============================================================

import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * Sync frequencies in milliseconds
 */
const SYNC_INTERVALS = {
  hourly: 60 * 60 * 1000, // 1 hour
  daily: 24 * 60 * 60 * 1000, // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Sync activity data for all users with active fitness connections
 *
 * This function should be called by a cron job or background worker
 */
export async function syncAllUserActivity(): Promise<{
  success: boolean;
  usersSynced: number;
  connectionsSynced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let usersSynced = 0;
  let connectionsSynced = 0;

  try {
    // Get all active fitness connections
    const connections = await prisma.fitnessConnection.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Group connections by user
    const connectionsByUser = new Map<string, any[]>();
    for (const connection of connections) {
      const userId = connection.userId;
      if (!connectionsByUser.has(userId)) {
        connectionsByUser.set(userId, []);
      }
      connectionsByUser.get(userId)!.push(connection);
    }

    // Sync each user's connections
    for (const [userId, userConnections] of connectionsByUser.entries()) {
      try {
        await syncUserActivity(userId, userConnections);
        usersSynced++;
        connectionsSynced += userConnections.length;
      } catch (error) {
        const errorMsg = `Failed to sync user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    return {
      success: true,
      usersSynced,
      connectionsSynced,
      errors,
    };
  } catch (error) {
    logger.error('Error in syncAllUserActivity:', error);
    return {
      success: false,
      usersSynced,
      connectionsSynced,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Sync activity data for a specific user
 */
export async function syncUserActivity(userId: string, connections?: any[]): Promise<void> {
  // If connections not provided, fetch them
  if (!connections) {
    connections = await prisma.fitnessConnection.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  if (connections.length === 0) {
    logger.debug(`No active fitness connections for user ${userId}`);
    return;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const connection of connections) {
    try {
      // Check if sync is needed based on frequency
      if (!shouldSync(connection, now)) {
        continue;
      }

      // Sync from platform
      const syncResult = await syncFromPlatform(connection, today);

      if (syncResult.success && syncResult.data) {
        // Store normalized activity data
        await storeActivitySync(connection, syncResult.data, today);

        // Update lastSyncAt
        await prisma.fitnessConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: now },
        });

        logger.info(`Successfully synced ${connection.platform} for user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error syncing ${connection.platform} for user ${userId}:`, error);
      throw error;
    }
  }
}

/**
 * Check if a connection should be synced based on its frequency and last sync time
 */
function shouldSync(connection: any, now: Date): boolean {
  const { lastSyncAt, syncFrequency } = connection;

  // If never synced, sync now
  if (!lastSyncAt) {
    return true;
  }

  const intervalMs =
    SYNC_INTERVALS[syncFrequency as keyof typeof SYNC_INTERVALS] || SYNC_INTERVALS.daily;
  const timeSinceLastSync = now.getTime() - new Date(lastSyncAt).getTime();

  return timeSinceLastSync >= intervalMs;
}

/**
 * Sync activity data from a specific platform
 */
async function syncFromPlatform(
  connection: any,
  syncDate: Date
): Promise<{
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

    default:
      return {
        success: false,
        error: `Unsupported platform: ${platform}`,
      };
  }
}

/**
 * Sync data from Fitbit
 */
async function syncFitbitData(accessToken: string, syncDate: Date) {
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

  const activityData = await activityResponse.json();

  // Fetch sleep data
  const sleepResponse = await fetch(
    `https://api.fitbit.com/1.2/user/-/sleep/date/${dateStr}.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sleepData: any = null;
  if (sleepResponse.ok) {
    sleepData = await sleepResponse.json();
  }

  return {
    success: true,
    data: {
      platform: 'fitbit',
      activity: activityData.summary,
      sleep: sleepData?.summary || null,
      activities: activityData.activities || [],
    },
  };
}

/**
 * Sync data from Oura
 */
async function syncOuraData(accessToken: string, syncDate: Date) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sleepData: any = null;
  if (sleepResponse.ok) {
    sleepData = await sleepResponse.json();
  }

  return {
    success: true,
    data: {
      platform: 'oura',
      activity: activityData.data?.[0] || null,
      sleep: sleepData?.data?.[0] || null,
    },
  };
}

/**
 * Sync data from Google Fit
 */
async function syncGoogleFitData(accessToken: string, syncDate: Date) {
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
        bucketByTime: { durationMillis: 86400000 },
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
    success: true,
    data: {
      platform: 'google_fit',
      steps: stepsData.bucket?.[0] || null,
    },
  };
}

/**
 * Store activity sync in database
 */
async function storeActivitySync(connection: any, syncData: any, syncDate: Date): Promise<void> {
  const normalizedData = normalizeSyncData(syncData);

  await prisma.activitySync.upsert({
    where: {
      connectionId_syncDate: {
        connectionId: connection.id,
        syncDate,
      },
    },
    create: {
      connectionId: connection.id,
      userId: connection.userId,
      platform: connection.platform,
      syncDate,
      ...normalizedData,
    },
    update: {
      ...normalizedData,
    },
  });
}

/**
 * Normalize sync data from various platforms to database schema
 */
function normalizeSyncData(syncData: any): any {
  const base = {
    rawSyncData: JSON.stringify(syncData),
    processed: false,
  };

  switch (syncData.platform) {
    case 'fitbit':
      const activity = syncData.activity;
      const sleep = syncData.sleep;
      return {
        ...base,
        steps: activity?.steps,
        activeCalories: activity?.activityCalories,
        totalCalories: activity?.caloriesOut,
        distanceKm: activity?.distance,
        distanceMiles: activity?.distances?.find((d: any) => d.activity === 'total')?.distance,
        activeMinutes: activity?.veryActiveMinutes + activity?.fairlyActiveMinutes,
        workoutCount: syncData.activities?.length || 0,
        workouts: JSON.stringify(
          syncData.activities?.map((a: any) => ({
            type: a.activityName,
            startTime: a.startTime,
            durationMinutes: Math.round(a.duration / 60000),
            caloriesBurned: a.calories,
          })) || []
        ),
        sleepMinutes: sleep?.totalSleepTime ? Math.round(sleep.totalSleepTime / 60000) : null,
        sleepScore: sleep?.efficiency || null,
      };

    case 'oura':
      const ouraActivity = syncData.activity;
      const ouraSleep = syncData.sleep;
      return {
        ...base,
        steps: ouraActivity?.steps,
        activeCalories: ouraActivity?.active_calories,
        totalCalories: ouraActivity?.total_calories,
        distanceKm: ouraActivity?.distance_km,
        distanceMiles: ouraActivity?.distance_km * 0.621371,
        activeMinutes:
          ouraActivity?.medium_activity_met_minutes && ouraActivity?.high_activity_met_minutes
            ? Math.round(
                ouraActivity.medium_activity_met_minutes + ouraActivity.high_activity_met_minutes
              )
            : null,
        sleepMinutes: ouraSleep?.duration,
        sleepScore: ouraSleep?.score,
      };

    case 'google_fit':
      const steps = syncData.steps?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal;
      return {
        ...base,
        steps: steps || null,
      };

    default:
      return base;
  }
}
