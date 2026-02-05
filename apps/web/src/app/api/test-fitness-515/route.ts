// ============================================================
// Test API for Fitness Integration (Feature #515)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { calculateCalorieAdjustment } from '@/lib/fitness/calculator';

/**
 * POST /api/test-fitness-515
 *
 * Test endpoint for adding mock fitness data
 * This simulates activity data from a fitness platform
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'add-activity') {
      // Get user's profile for base calorie target
      const profile = await prisma.userProfile.findFirst({
        where: { userId, isActive: true },
      });

      if (!profile || !profile.goalKcal) {
        return NextResponse.json(
          { error: 'No calorie target found' },
          { status: 404 },
        );
      }

      // Create a test connection
      const connection = await prisma.fitnessConnection.upsert({
        where: {
          userId_platform: { userId, platform: 'test_platform' },
        },
        create: {
          userId,
          platform: 'test_platform',
          accessToken: 'test_token',
          isActive: true,
          syncFrequency: 'daily',
          settings: '{}',
        },
        update: { isActive: true },
      });

      // Create test activity data
      const testDate = new Date();
      testDate.setHours(0, 0, 0, 0);

      await prisma.activitySync.upsert({
        where: {
          connectionId_syncDate: {
            connectionId: connection.id,
            syncDate: testDate,
          },
        },
        create: {
          connectionId: connection.id,
          userId,
          platform: 'test_platform',
          syncDate: testDate,
          steps: 10000,
          activeCalories: 500,
          totalCalories: 2500,
          distanceKm: 8,
          distanceMiles: 5,
          activeMinutes: 60,
          workoutCount: 2,
          workouts: JSON.stringify([
            {
              type: 'running',
              startTime: new Date(testDate.getTime() + 7 * 60 * 60 * 1000).toISOString(),
              durationMinutes: 30,
              caloriesBurned: 300,
            },
            {
              type: 'strength_training',
              startTime: new Date(testDate.getTime() + 17 * 60 * 60 * 1000).toISOString(),
              durationMinutes: 45,
              caloriesBurned: 200,
            },
          ]),
          heartRateAvg: 140,
          heartRateMax: 175,
          processed: false,
        },
        update: {
          steps: 10000,
          activeCalories: 500,
          totalCalories: 2500,
          distanceKm: 8,
          distanceMiles: 5,
          activeMinutes: 60,
          workoutCount: 2,
          workouts: JSON.stringify([
            {
              type: 'running',
              startTime: new Date(testDate.getTime() + 7 * 60 * 60 * 1000).toISOString(),
              durationMinutes: 30,
              caloriesBurned: 300,
            },
            {
              type: 'strength_training',
              startTime: new Date(testDate.getTime() + 17 * 60 * 60 * 1000).toISOString(),
              durationMinutes: 45,
              caloriesBurned: 200,
            },
          ]),
          heartRateAvg: 140,
          heartRateMax: 175,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Test activity data added',
        data: {
          date: testDate.toISOString().split('T')[0],
          steps: 10000,
          activeCalories: 500,
          workouts: 2,
        },
      });
    }

    if (action === 'calculate-adjustment') {
      // Get user's profile
      const profile = await prisma.userProfile.findFirst({
        where: { userId, isActive: true },
      });

      if (!profile || !profile.goalKcal) {
        return NextResponse.json(
          { error: 'No calorie target found' },
          { status: 404 },
        );
      }

      // Calculate adjustment with mock data
      const adjustment = calculateCalorieAdjustment(profile.goalKcal, {
        platform: 'apple_health',
        syncDate: new Date(),
        activeCalories: 500,
        workouts: [
          {
            type: 'running',
            startTime: new Date(),
            durationMinutes: 30,
            caloriesBurned: 300,
          },
          {
            type: 'strength_training',
            startTime: new Date(),
            durationMinutes: 45,
            caloriesBurned: 200,
          },
        ],
        activeMinutes: 75,
      });

      return NextResponse.json({
        success: true,
        baseTarget: profile.goalKcal,
        adjustedTarget: adjustment.newTarget,
        adjustment: adjustment.adjustment,
        reason: adjustment.reason,
      });
    }

    if (action === 'clear-data') {
      // Delete test data
      await prisma.activitySync.deleteMany({
        where: {
          userId,
          platform: 'test_platform',
        },
      });

      await prisma.fitnessConnection.updateMany({
        where: {
          userId,
          platform: 'test_platform',
        },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Test data cleared',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error in test fitness API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/test-fitness-515
 *
 * Get test status and instructions
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json({
    name: 'Fitness Integration Test API',
    version: '1.0.0',
    actions: {
      'add-activity': 'Add mock fitness activity data for today',
      'calculate-adjustment': 'Calculate calorie adjustment based on activity',
      'clear-data': 'Clear all test fitness data',
    },
    example: {
      action: 'add-activity',
    },
  });
}
