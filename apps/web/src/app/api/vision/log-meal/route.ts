import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '@/lib/safe-logger';

// Request schema for confirming and logging a vision analysis
const LogVisionMealSchema = z.object({
  scanId: z.string().uuid(),
  adjustedResult: z
    .object({
      meal_name: z.string(),
      description: z.string(),
      estimated_nutrition: z.object({
        calories: z.number(),
        protein_g: z.number(),
        carbs_g: z.number(),
        fat_g: z.number(),
        fiber_g: z.number().optional(),
      }),
      portion_size_estimate: z.string(),
    })
    .optional(), // User can adjust the analysis before logging
  date: z.string().optional(), // YYYY-MM-DD format, defaults to today
  mealSlot: z.string().optional(), // breakfast, lunch, dinner, snack, etc.
});

interface LogVisionMealRequest {
  scanId: string;
  adjustedResult?: {
    meal_name: string;
    description: string;
    estimated_nutrition: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g?: number;
    };
    portion_size_estimate: string;
  };
  date?: string;
  mealSlot?: string;
}

/**
 * POST /api/vision/log-meal
 *
 * Confirm a vision analysis and log it as a tracked meal
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    let dbUserId: string;
    try {
      ({ dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    // Parse and validate request
    const body: LogVisionMealRequest = await request.json();
    const validation = LogVisionMealSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { scanId, adjustedResult, date, mealSlot } = validation.data;

    // Fetch the FoodScan
    const foodScan = await prisma.foodScan.findUnique({
      where: { id: scanId },
    });

    if (!foodScan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Verify ownership (FoodScan records are created with dbUserId)
    if (foodScan.userId !== dbUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if scan is completed
    if (foodScan.status !== 'completed') {
      return NextResponse.json(
        { error: 'Scan not completed', status: foodScan.status },
        { status: 400 }
      );
    }

    // Use adjusted result if provided, otherwise use original analysis
    // analysisResult and adjustedResult are now Prisma Json types - no parsing needed
    let nutritionData: LogVisionMealRequest['adjustedResult'];
    if (adjustedResult) {
      // Update the scan with adjusted result (Json type - pass object directly)
      await prisma.foodScan.update({
        where: { id: scanId },
        data: { adjustedResult: adjustedResult },
      });
      nutritionData = adjustedResult;
    } else {
      nutritionData = foodScan.analysisResult as LogVisionMealRequest['adjustedResult'];
    }

    if (!nutritionData?.estimated_nutrition) {
      return NextResponse.json({ error: 'No nutrition data available' }, { status: 400 });
    }

    // Create tracked meal
    const trackedMealId = uuidv4();

    // Parse date (default to today)
    const loggedDate = date
      ? new Date(date + 'T00:00:00.000Z')
      : new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');

    await prisma.trackedMeal.create({
      data: {
        id: trackedMealId,
        userId: dbUserId,
        loggedDate,
        mealSlot: mealSlot || 'snack',
        mealName: nutritionData.meal_name,
        portion: 1.0,
        kcal: Math.round(nutritionData.estimated_nutrition.calories),
        proteinG: Math.round(nutritionData.estimated_nutrition.protein_g),
        carbsG: Math.round(nutritionData.estimated_nutrition.carbs_g),
        fatG: Math.round(nutritionData.estimated_nutrition.fat_g),
        fiberG: nutritionData.estimated_nutrition.fiber_g
          ? Math.round(nutritionData.estimated_nutrition.fiber_g)
          : null,
        source: 'food_scan',
        scanId,
        confidenceScore: 0.8, // Vision-based analysis has good confidence
      },
    });

    // Mark scan as confirmed
    await prisma.foodScan.update({
      where: { id: scanId },
      data: { userConfirmed: true },
    });

    // Update daily log
    const dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: dbUserId,
          date: loggedDate,
        },
      },
    });

    if (dailyLog) {
      // Update existing daily log
      await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: {
          actualKcal: { increment: Math.round(nutritionData.estimated_nutrition.calories) },
          actualProteinG: { increment: Math.round(nutritionData.estimated_nutrition.protein_g) },
          actualCarbsG: { increment: Math.round(nutritionData.estimated_nutrition.carbs_g) },
          actualFatG: { increment: Math.round(nutritionData.estimated_nutrition.fat_g) },
        },
      });
    }

    return NextResponse.json({
      success: true,
      trackedMealId,
      meal: {
        id: trackedMealId,
        name: nutritionData.meal_name,
        date: loggedDate,
        mealSlot: mealSlot || 'snack',
        nutrition: nutritionData.estimated_nutrition,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log meal';
    logger.error('Error in /api/vision/log-meal:', message);

    return NextResponse.json(
      {
        error: 'Failed to log meal',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vision/log-meal?scanId=xxx
 *
 * Get details of a food scan (for review before logging)
 */
export async function GET(request: Request) {
  try {
    let dbUserId: string;
    try {
      ({ dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId');

    if (!scanId) {
      return NextResponse.json({ error: 'scanId is required' }, { status: 400 });
    }

    const foodScan = await prisma.foodScan.findUnique({
      where: { id: scanId },
    });

    if (!foodScan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Verify ownership (FoodScan records are created with dbUserId)
    if (foodScan.userId !== dbUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return scan details
    // analysisResult and adjustedResult are now Prisma Json types - no parsing needed
    return NextResponse.json({
      id: foodScan.id,
      status: foodScan.status,
      scanType: foodScan.scanType,
      photoUrl: foodScan.photoUrl,
      analysisResult: foodScan.analysisResult,
      adjustedResult: foodScan.adjustedResult,
      userConfirmed: foodScan.userConfirmed,
      createdAt: foodScan.createdAt,
      completedAt: foodScan.completedAt,
      error: foodScan.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch scan';
    logger.error('Error in GET /api/vision/log-meal:', message);

    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 });
  }
}
