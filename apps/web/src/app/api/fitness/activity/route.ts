// ============================================================
// Get Activity History and Apply Calorie Adjustments
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateCalorieAdjustment } from '@/lib/fitness/calculator';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/fitness/activity?date=2024-01-15
 *
 * Get activity data for a specific date with calorie adjustment calculation
 */
export async function GET(req: NextRequest) {
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

    const searchParams = req.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Default to today if no date specified
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    // Get user's profile for base calorie target
    const profile = await prisma.userProfile.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!profile || !profile.goalKcal) {
      return NextResponse.json(
        { error: 'User profile not found or calorie target not set' },
        { status: 404 }
      );
    }

    const baseTarget = profile.goalKcal;

    // Get activity syncs for the date
    const activitySyncs = await prisma.activitySync.findMany({
      where: {
        userId,
        syncDate: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lte: new Date(targetDate.setHours(23, 59, 59, 999)),
        },
      },
      include: {
        connection: true,
      },
    });

    if (activitySyncs.length === 0) {
      return NextResponse.json({
        date: targetDate.toISOString().split('T')[0],
        baseTarget,
        adjustedTarget: baseTarget,
        adjustment: 0,
        activities: [],
        message: 'No activity data available for this date',
      });
    }

    // Aggregate activity data from all platforms
    const activities: any[] = [];

    // workouts is now a Prisma Json type - no parsing needed
    for (const sync of activitySyncs) {
      activities.push({
        platform: sync.platform,
        steps: sync.steps,
        activeCalories: sync.activeCalories,
        totalCalories: sync.totalCalories,
        distanceKm: sync.distanceKm,
        distanceMiles: sync.distanceMiles,
        activeMinutes: sync.activeMinutes,
        workoutCount: sync.workoutCount,
        workouts: (Array.isArray(sync.workouts) ? sync.workouts : []) as unknown[],
        sleepMinutes: sync.sleepMinutes,
        sleepScore: sync.sleepScore,
        heartRateAvg: sync.heartRateAvg,
        heartRateMax: sync.heartRateMax,
        syncedAt: sync.syncedAt,
      });
    }

    // Calculate calorie adjustment based on aggregated data
    const totalActiveCalories = activities.reduce((sum, a) => sum + (a.activeCalories || 0), 0);
    const totalWorkouts = activities.reduce((sum, a) => sum + (a.workoutCount || 0), 0);
    const totalActiveMinutes = activities.reduce((sum, a) => sum + (a.activeMinutes || 0), 0);

    // Use the calculator to determine adjustment
    const adjustment = calculateCalorieAdjustment(baseTarget, {
      platform: 'apple_health',
      syncDate: targetDate,
      activeCalories: totalActiveCalories,
      workouts: activities.flatMap((a) => a.workouts || []),
      activeMinutes: totalActiveMinutes,
    });

    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      baseTarget,
      adjustedTarget: adjustment.newTarget,
      adjustment: adjustment.adjustment,
      reason: adjustment.reason,
      activities,
      totalActiveCalories,
      totalWorkouts,
      totalActiveMinutes,
    });
  } catch (error) {
    logger.error('Error fetching activity data:', error);
    return NextResponse.json({ error: 'Failed to fetch activity data' }, { status: 500 });
  }
}

/**
 * POST /api/fitness/activity
 *
 * Manually log activity data (for testing or Apple HealthKit)
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
    const { platform, syncDate, activityData } = body;

    if (!platform || !syncDate) {
      return NextResponse.json({ error: 'Platform and syncDate are required' }, { status: 400 });
    }

    // Get or create connection
    let connection = await prisma.fitnessConnection.findFirst({
      where: {
        userId,
        platform,
        isActive: true,
      },
    });

    if (!connection) {
      // Create a manual connection (for Apple HealthKit or testing)
      // settings is now a Prisma Json type - pass object directly
      connection = await prisma.fitnessConnection.create({
        data: {
          userId,
          platform,
          accessToken: 'manual',
          isActive: true,
          syncFrequency: 'daily',
          settings: {},
        },
      });
    }

    // Create or update activity sync
    // workouts and rawSyncData are now Prisma Json types - pass objects directly
    const sync = await prisma.activitySync.upsert({
      where: {
        connectionId_syncDate: {
          connectionId: connection.id,
          syncDate: new Date(syncDate),
        },
      },
      create: {
        connectionId: connection.id,
        userId,
        platform,
        syncDate: new Date(syncDate),
        steps: activityData.steps,
        activeCalories: activityData.activeCalories,
        totalCalories: activityData.totalCalories,
        distanceKm: activityData.distanceKm,
        distanceMiles: activityData.distanceMiles,
        activeMinutes: activityData.activeMinutes,
        workoutCount: activityData.workoutCount,
        workouts: activityData.workouts || [],
        sleepMinutes: activityData.sleepMinutes,
        sleepScore: activityData.sleepScore,
        heartRateAvg: activityData.heartRateAvg,
        heartRateMax: activityData.heartRateMax,
        rawSyncData: activityData.raw || {},
        processed: false,
      },
      update: {
        steps: activityData.steps,
        activeCalories: activityData.activeCalories,
        totalCalories: activityData.totalCalories,
        distanceKm: activityData.distanceKm,
        distanceMiles: activityData.distanceMiles,
        activeMinutes: activityData.activeMinutes,
        workoutCount: activityData.workoutCount,
        workouts: activityData.workouts || [],
        sleepMinutes: activityData.sleepMinutes,
        sleepScore: activityData.sleepScore,
        heartRateAvg: activityData.heartRateAvg,
        heartRateMax: activityData.heartRateMax,
        rawSyncData: activityData.raw || {},
      },
    });

    return NextResponse.json({
      success: true,
      sync,
      message: 'Activity data saved successfully',
    });
  } catch (error) {
    logger.error('Error saving activity data:', error);
    return NextResponse.json({ error: 'Failed to save activity data' }, { status: 500 });
  }
}
