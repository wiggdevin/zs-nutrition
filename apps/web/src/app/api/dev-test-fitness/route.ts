// ============================================================
// Dev Test Endpoint for Fitness Integration
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/dev-test-fitness
 *
 * Creates mock fitness activity data for testing
 * DEV ONLY - This endpoint bypasses authentication
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const body = await req.json();
    const { email = 'test-416-adherence@example.com', date } = body;

    // Get user by email
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get or create fitness connection
    let connection = await prisma.fitnessConnection.findFirst({
      where: {
        userId: user.id,
        platform: 'fitbit',
        isActive: true,
      },
    });

    if (!connection) {
      connection = await prisma.fitnessConnection.create({
        data: {
          userId: user.id,
          platform: 'fitbit',
          accessToken: 'test_token_515',
          isActive: true,
          syncFrequency: 'daily',
          settings: '{}',
          lastSyncAt: new Date(),
        },
      });
    }

    // Create mock activity sync
    const mockWorkouts = [
      {
        type: 'running',
        startTime: new Date().toISOString(),
        durationMinutes: 35,
        caloriesBurned: 320,
        distanceKm: 5.2,
      },
      {
        type: 'strength_training',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        durationMinutes: 45,
        caloriesBurned: 167,
      },
    ];

    const activitySync = await prisma.activitySync.upsert({
      where: {
        connectionId_syncDate: {
          connectionId: connection.id,
          syncDate: new Date(targetDate),
        },
      },
      create: {
        connectionId: connection.id,
        userId: user.id,
        platform: 'fitbit',
        syncDate: new Date(targetDate),
        steps: 10543,
        activeCalories: 487,
        totalCalories: 2456,
        distanceKm: 8.2,
        distanceMiles: 5.1,
        activeMinutes: 67,
        workoutCount: 2,
        workouts: JSON.stringify(mockWorkouts),
        heartRateAvg: 142,
        heartRateMax: 178,
        rawSyncData: JSON.stringify({ source: 'TEST_515_MOCK_DATA' }),
        processed: false,
      },
      update: {
        steps: 10543,
        activeCalories: 487,
        totalCalories: 2456,
        distanceKm: 8.2,
        distanceMiles: 5.1,
        activeMinutes: 67,
        workoutCount: 2,
        workouts: JSON.stringify(mockWorkouts),
        heartRateAvg: 142,
        heartRateMax: 178,
        rawSyncData: JSON.stringify({ source: 'TEST_515_MOCK_DATA' }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Mock fitness data created successfully',
      data: {
        userId: user.id,
        connectionId: connection.id,
        activitySyncId: activitySync.id,
        date: targetDate,
        steps: 10543,
        activeCalories: 487,
        workouts: mockWorkouts,
      },
    });
  } catch (error) {
    console.error('Error creating mock fitness data:', error);
    return NextResponse.json(
      { error: 'Failed to create mock data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
