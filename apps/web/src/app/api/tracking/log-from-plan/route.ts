import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { calculateAdherenceScore } from '@/lib/adherence'
import { safeLogError } from '@/lib/safe-logger'

export async function POST(request: NextRequest) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { planId, dayNumber, slot, portion: portionInput } = body;
    const portion = typeof portionInput === 'number' && portionInput > 0 ? portionInput : 1.0;

    if (!planId || !dayNumber || !slot) {
      return NextResponse.json({ error: 'Missing required fields: planId, dayNumber, slot' }, { status: 400 });
    }

    // Get the meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { id: planId, userId: user.id },
    });

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Parse the validated plan to find the specific meal
    const validatedPlan = JSON.parse(mealPlan.validatedPlan);
    const day = validatedPlan.days?.find(
      (d: { dayNumber: number }) => d.dayNumber === dayNumber
    );

    if (!day) {
      return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 });
    }

    const meal = day.meals?.find(
      (m: { slot: string }) => m.slot.toLowerCase() === slot.toLowerCase()
    );

    if (!meal) {
      return NextResponse.json({ error: 'Meal not found in plan day' }, { status: 404 });
    }

    // Create today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use a serialized transaction to prevent race conditions from concurrent requests
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate: same user, same plan, same slot, same day
      const existingLog = await tx.trackedMeal.findFirst({
        where: {
          userId: user.id,
          mealPlanId: planId,
          mealSlot: meal.slot,
          loggedDate: today,
          source: 'plan_meal',
        },
      });

      if (existingLog) {
        // Return the existing entry instead of creating a duplicate (idempotent)
        return {
          success: true,
          duplicate: true,
          trackedMeal: {
            id: existingLog.id,
            name: existingLog.mealName,
            calories: existingLog.kcal,
            protein: existingLog.proteinG,
            carbs: existingLog.carbsG,
            fat: existingLog.fatG,
            source: existingLog.source,
            mealSlot: existingLog.mealSlot,
          },
        };
      }

      // Apply portion multiplier to nutrition
      const adjustedKcal = Math.round(meal.nutrition.kcal * portion);
      const adjustedProteinG = Math.round(meal.nutrition.proteinG * portion * 10) / 10;
      const adjustedCarbsG = Math.round(meal.nutrition.carbsG * portion * 10) / 10;
      const adjustedFatG = Math.round(meal.nutrition.fatG * portion * 10) / 10;
      const adjustedFiberG = meal.nutrition.fiberG ? Math.round(meal.nutrition.fiberG * portion * 10) / 10 : null;

      // Create the TrackedMeal with source 'plan_meal'
      const trackedMeal = await tx.trackedMeal.create({
        data: {
          userId: user.id,
          mealPlanId: planId,
          loggedDate: today,
          mealSlot: meal.slot,
          mealName: meal.name,
          portion,
          kcal: adjustedKcal,
          proteinG: adjustedProteinG,
          carbsG: adjustedCarbsG,
          fatG: adjustedFatG,
          fiberG: adjustedFiberG,
          source: 'plan_meal',
          confidenceScore: meal.confidenceLevel === 'verified' ? 1.0 : 0.7,
        },
      });

      // Update or create DailyLog with new totals
      const dailyLog = await tx.dailyLog.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: today,
          },
        },
        create: {
          userId: user.id,
          date: today,
          targetKcal: mealPlan.dailyKcalTarget,
          targetProteinG: mealPlan.dailyProteinG,
          targetCarbsG: mealPlan.dailyCarbsG,
          targetFatG: mealPlan.dailyFatG,
          actualKcal: adjustedKcal,
          actualProteinG: Math.round(adjustedProteinG),
          actualCarbsG: Math.round(adjustedCarbsG),
          actualFatG: Math.round(adjustedFatG),
        },
        update: {
          actualKcal: { increment: adjustedKcal },
          actualProteinG: { increment: Math.round(adjustedProteinG) },
          actualCarbsG: { increment: Math.round(adjustedCarbsG) },
          actualFatG: { increment: Math.round(adjustedFatG) },
        },
      });

      // Calculate weighted adherence score
      const adherenceScore = calculateAdherenceScore(dailyLog);

      // Update adherence score
      await tx.dailyLog.update({
        where: { id: dailyLog.id },
        data: { adherenceScore },
      });

      return {
        success: true,
        trackedMeal: {
          id: trackedMeal.id,
          name: trackedMeal.mealName,
          calories: trackedMeal.kcal,
          protein: trackedMeal.proteinG,
          carbs: trackedMeal.carbsG,
          fat: trackedMeal.fatG,
          source: trackedMeal.source,
          mealSlot: trackedMeal.mealSlot,
        },
        dailyLog: {
          actualKcal: dailyLog.actualKcal,
          actualProteinG: dailyLog.actualProteinG,
          actualCarbsG: dailyLog.actualCarbsG,
          actualFatG: dailyLog.actualFatG,
          adherenceScore,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    safeLogError('Log from plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
