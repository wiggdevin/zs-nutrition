// ============================================================
// Background Sync Scheduler for Fitness Platforms
// ============================================================

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/safe-logger';
import { OuraApiClient } from './oura-client';
import type { FitnessConnection, Prisma } from '@prisma/client';
import type {
  FitbitActivitySummary,
  FitbitSleepSummary,
  FitbitActivity,
  FitbitDistance,
} from './types';
import type {
  OuraDaySyncData,
  OuraSleepPeriod,
  OuraHeartRateSample,
  OuraWorkout,
} from './oura-types';

// ---- Platform-specific sync data shapes ----

interface FitbitSyncData {
  platform: 'fitbit';
  activity: FitbitActivitySummary;
  sleep: FitbitSleepSummary | null;
  activities: FitbitActivity[];
}

interface OuraSyncData extends OuraDaySyncData {
  platform: 'oura';
}

interface GoogleFitSyncData {
  platform: 'google_fit';
  steps: { dataset?: Array<{ point?: Array<{ value?: Array<{ intVal?: number }> }> }> } | null;
}

type PlatformSyncData = FitbitSyncData | OuraSyncData | GoogleFitSyncData;

interface SyncResult {
  success: boolean;
  data?: PlatformSyncData;
  error?: string;
}

/** Fields returned by normalizeSyncData for ActivitySync upsert */
interface NormalizedSyncFields {
  rawSyncData: Prisma.InputJsonValue;
  processed: boolean;
  steps?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  distanceKm?: number | null;
  distanceMiles?: number | null;
  activeMinutes?: number | null;
  workoutCount?: number;
  workouts?: Prisma.InputJsonValue;
  sleepMinutes?: number | null;
  sleepScore?: number | null;
  heartRateResting?: number | null;
  readinessScore?: number | null;
  readinessTemperature?: number | null;
  readinessHrvBalance?: number | null;
  hrvAvg?: number | null;
  sleepDeepMinutes?: number | null;
  sleepRemMinutes?: number | null;
  sleepLightMinutes?: number | null;
  sleepAwakeMinutes?: number | null;
  sleepEfficiency?: number | null;
  sleepLatency?: number | null;
  bedtimeStart?: Date | null;
  bedtimeEnd?: Date | null;
  bodyTemperatureDelta?: number | null;
}

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
    const connectionsByUser = new Map<string, FitnessConnection[]>();
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
export async function syncUserActivity(
  userId: string,
  connections?: FitnessConnection[],
  options?: { force?: boolean }
): Promise<void> {
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
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  for (const connection of connections) {
    try {
      // Check if sync is needed based on frequency (skip for manual/forced syncs)
      if (!options?.force && !shouldSync(connection, now)) {
        continue;
      }

      if (connection.platform === 'oura') {
        // Oura: fetch a date range (data lags by ~1 day)
        await syncOuraDateRange(connection, yesterday, options?.force);
      } else {
        // Other platforms: sync single day
        const syncResult = await syncFromPlatform(connection, yesterday);
        if (syncResult.success && syncResult.data) {
          await storeActivitySync(connection, syncResult.data, yesterday);
        }
      }

      // Update lastSyncAt
      await prisma.fitnessConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now },
      });

      logger.warn(`Successfully synced ${connection.platform} for user ${userId}`);
    } catch (error) {
      logger.error(`Error syncing ${connection.platform} for user ${userId}:`, error);
      throw error;
    }
  }
}

/**
 * Check if a connection should be synced based on its frequency and last sync time
 */
function shouldSync(connection: FitnessConnection, now: Date): boolean {
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
  connection: FitnessConnection,
  syncDate: Date
): Promise<SyncResult> {
  const platform = connection.platform;

  switch (platform) {
    case 'fitbit': {
      const accessToken = decrypt(connection.accessToken);
      return await syncFitbitData(accessToken, syncDate);
    }

    case 'google_fit': {
      const accessToken = decrypt(connection.accessToken);
      return await syncGoogleFitData(accessToken, syncDate);
    }

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

  let sleepData: { summary?: FitbitSleepSummary } | null = null;
  if (sleepResponse.ok) {
    sleepData = await sleepResponse.json();
  }

  return {
    success: true,
    data: {
      platform: 'fitbit' as const,
      activity: activityData.summary as FitbitActivitySummary,
      sleep: (sleepData?.summary as FitbitSleepSummary) || null,
      activities: (activityData.activities || []) as FitbitActivity[],
    },
  };
}

/**
 * Sync Oura data for a date range and store each day separately.
 * First sync: 14 days back. Subsequent syncs: from lastSyncAt to endDate.
 */
async function syncOuraDateRange(
  connection: FitnessConnection,
  endDate: Date,
  force?: boolean
): Promise<void> {
  const BACKFILL_DAYS = 14;

  // Calculate start date
  let startDate: Date;
  if (connection.lastSyncAt && !force) {
    // Subsequent sync: from last sync date
    const lastSync = new Date(connection.lastSyncAt);
    startDate = new Date(lastSync.getFullYear(), lastSync.getMonth(), lastSync.getDate() - 1);
  } else {
    // First sync or forced: backfill 14 days
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - BACKFILL_DAYS);
  }

  // Don't go further back than 14 days (Oura API limit for some endpoints)
  const maxBackfill = new Date(endDate);
  maxBackfill.setDate(maxBackfill.getDate() - BACKFILL_DAYS);
  if (startDate < maxBackfill) {
    startDate = maxBackfill;
  }

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  logger.warn(`Oura sync range: ${startStr} to ${endStr}`);

  const client = new OuraApiClient({
    connectionId: connection.id,
    encryptedAccessToken: connection.accessToken,
    encryptedRefreshToken: connection.refreshToken,
  });

  const dayDataMap = await client.fetchDateRange(startStr, endStr);

  // Store each day
  let storedCount = 0;
  for (const [dayStr, dayData] of dayDataMap.entries()) {
    try {
      const syncDate = new Date(dayStr + 'T00:00:00Z');
      await storeActivitySync(connection, { platform: 'oura' as const, ...dayData }, syncDate);
      storedCount++;
    } catch (error) {
      logger.error(`Failed to store Oura data for ${dayStr}:`, error);
    }
  }

  logger.warn(`Oura: stored ${storedCount}/${dayDataMap.size} days of data`);
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
      platform: 'google_fit' as const,
      steps: stepsData.bucket?.[0] || null,
    },
  };
}

/**
 * Store activity sync in database
 */
async function storeActivitySync(
  connection: FitnessConnection,
  syncData: PlatformSyncData,
  syncDate: Date
): Promise<void> {
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
function normalizeSyncData(syncData: PlatformSyncData): NormalizedSyncFields {
  const base = {
    rawSyncData: JSON.parse(JSON.stringify(syncData)) as Prisma.InputJsonValue,
    processed: false,
  };

  switch (syncData.platform) {
    case 'fitbit': {
      const activity = syncData.activity;
      const sleep = syncData.sleep;
      return {
        ...base,
        steps: activity?.steps,
        activeCalories: activity?.activityCalories,
        totalCalories: activity?.caloriesOut,
        distanceKm: activity?.distance,
        distanceMiles: activity?.distances?.find((d: FitbitDistance) => d.activity === 'total')
          ?.distance,
        activeMinutes: activity?.veryActiveMinutes + activity?.fairlyActiveMinutes,
        workoutCount: syncData.activities?.length || 0,
        workouts:
          syncData.activities?.map((a: FitbitActivity) => ({
            type: a.activityName,
            startTime: a.startTime,
            durationMinutes: Math.round(a.duration / 60000),
            caloriesBurned: a.calories,
          })) || [],
        sleepMinutes: sleep?.totalSleepTime ? Math.round(sleep.totalSleepTime / 60000) : null,
        sleepScore: sleep?.efficiency || null,
      };
    }

    case 'oura': {
      const ouraActivity = syncData.activity;
      const ouraSleep = syncData.sleep;
      const sleepPeriods = syncData.sleepPeriods || [];
      const readiness = syncData.readiness;
      const heartRateSamples = syncData.heartRate || [];

      // Find the main (longest) sleep period for detailed data
      const mainSleep = sleepPeriods
        .filter((s: OuraSleepPeriod) => s.type === 'long_sleep')
        .sort((a: OuraSleepPeriod, b: OuraSleepPeriod) => (b.duration || 0) - (a.duration || 0))[0];

      // Calculate average resting heart rate from sleep/rest samples
      const restingSamples = heartRateSamples.filter(
        (s: OuraHeartRateSample) => s.source === 'rest' || s.source === 'sleep'
      );
      const restingHR =
        restingSamples.length > 0
          ? restingSamples.reduce((sum: number, s: OuraHeartRateSample) => sum + s.bpm, 0) /
            restingSamples.length
          : null;

      return {
        ...base,
        steps: ouraActivity?.steps,
        activeCalories: ouraActivity?.active_calories,
        totalCalories: ouraActivity?.total_calories,
        distanceKm: ouraActivity?.equivalent_walking_distance
          ? ouraActivity.equivalent_walking_distance / 1000
          : null,
        distanceMiles: ouraActivity?.equivalent_walking_distance
          ? (ouraActivity.equivalent_walking_distance / 1000) * 0.621371
          : null,
        activeMinutes:
          ouraActivity?.medium_activity_met_minutes !== null &&
          ouraActivity?.medium_activity_met_minutes !== undefined &&
          ouraActivity?.high_activity_met_minutes !== null &&
          ouraActivity?.high_activity_met_minutes !== undefined
            ? Math.round(
                ouraActivity.medium_activity_met_minutes + ouraActivity.high_activity_met_minutes
              )
            : null,
        sleepMinutes:
          mainSleep?.total_sleep_duration !== null && mainSleep?.total_sleep_duration !== undefined
            ? Math.round(mainSleep.total_sleep_duration / 60)
            : null,
        sleepScore: ouraSleep?.score,
        heartRateResting: restingHR ? Math.round(restingHR * 10) / 10 : null,

        // Readiness
        readinessScore: readiness?.score ?? null,
        readinessTemperature: readiness?.temperature_deviation ?? null,
        readinessHrvBalance: readiness?.contributors?.hrv_balance ?? null,

        // HRV
        hrvAvg: mainSleep?.average_hrv ?? null,

        // Sleep stages (convert seconds to minutes)
        sleepDeepMinutes:
          mainSleep?.deep_sleep_duration !== null && mainSleep?.deep_sleep_duration !== undefined
            ? Math.round(mainSleep.deep_sleep_duration / 60)
            : null,
        sleepRemMinutes:
          mainSleep?.rem_sleep_duration !== null && mainSleep?.rem_sleep_duration !== undefined
            ? Math.round(mainSleep.rem_sleep_duration / 60)
            : null,
        sleepLightMinutes:
          mainSleep?.light_sleep_duration !== null && mainSleep?.light_sleep_duration !== undefined
            ? Math.round(mainSleep.light_sleep_duration / 60)
            : null,
        sleepAwakeMinutes:
          mainSleep?.awake_time !== null && mainSleep?.awake_time !== undefined
            ? Math.round(mainSleep.awake_time / 60)
            : null,
        sleepEfficiency: mainSleep?.efficiency ?? null,
        sleepLatency: mainSleep?.latency ?? null,

        // Sleep timing
        bedtimeStart: mainSleep?.bedtime_start ? new Date(mainSleep.bedtime_start) : null,
        bedtimeEnd: mainSleep?.bedtime_end ? new Date(mainSleep.bedtime_end) : null,

        // Body temperature
        bodyTemperatureDelta: readiness?.temperature_deviation ?? null,

        // Workouts
        workoutCount: syncData.workouts?.length || 0,
        workouts: (syncData.workouts || []).map((w: OuraWorkout) => ({
          type: w.activity,
          startTime: w.start_datetime,
          endTime: w.end_datetime,
          calories: w.calories,
          distance: w.distance,
          intensity: w.intensity,
        })),
      };
    }

    case 'google_fit': {
      const steps = syncData.steps?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal;
      return {
        ...base,
        steps: steps || null,
      };
    }

    default:
      return base;
  }
}
