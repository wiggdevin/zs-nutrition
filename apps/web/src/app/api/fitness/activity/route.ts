// ============================================================
// Get Activity History and Apply Calorie Adjustments
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { calculateCalorieAdjustment, aggregateActivityData } from '@/lib/fitness/calculator';

/**
 * GET /api/fitness/activity?date=2024-01-15
 *
 * Get activity data for a specific date with calorie adjustment calculation
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        { status: 404 },
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
        workouts: JSON.parse(sync.workouts || '[]'),
        sleepMinutes: sync.sleepMinutes,
        sleepScore: sync.sleepScore,
        heartRateAvg: sync.heartRateAvg,
        heartRateMax: sync.heartRateMax,
        syncedAt: sync.syncedAt,
      });
    }

    // Calculate calorie adjustment based on aggregated data
    const totalActiveCalories = activities.reduce(
      (sum, a) => sum + (a.activeCalories || 0),
      0,
    );
    const totalWorkouts = activities.reduce(
      (sum, a) => sum + (a.workoutCount || 0),
      0,
    );
    const totalActiveMinutes = activities.reduce(
      (sum, a) => sum + (a.activeMinutes || 0),
      0,
    );

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
    console.error('Error fetching activity data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity data' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/fitness/activity
 *
 * Manually log activity data (for testing or Apple HealthKit)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { platform, syncDate, activityData } = body;

    if (!platform || !syncDate) {
      return NextResponse.json(
        { error: 'Platform and syncDate are required' },
        { status: 400 },
      );
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
      connection = await prisma.fitnessConnection.create({
        data: {
          userId,
          platform,
          accessToken: 'manual',
          isActive: true,
          syncFrequency: 'daily',
          settings: '{}',
        },
      });
    }

    // Create or update activity sync
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
        workouts: JSON.stringify(activityData.workouts || []),
        sleepMinutes: activityData.sleepMinutes,
        sleepScore: activityData.sleepScore,
        heartRateAvg: activityData.heartRateAvg,
        heartRateMax: activityData.heartRateMax,
        rawSyncData: JSON.stringify(activityData.raw || {}),
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
        workouts: JSON.stringify(activityData.workouts || []),
        sleepMinutes: activityData.sleepMinutes,
        sleepScore: activityData.sleepScore,
        heartRateAvg: activityData.heartRateAvg,
        heartRateMax: activityData.heartRateMax,
        rawSyncData: JSON.stringify(activityData.raw || {}),
      },
    });

    return NextResponse.json({
      success: true,
      sync,
      message: 'Activity data saved successfully',
    });
  } catch (error) {
    console.error('Error saving activity data:', error);
    return NextResponse.json(
      { error: 'Failed to save activity data' },
      { status: 500 },
    );
  }
}
