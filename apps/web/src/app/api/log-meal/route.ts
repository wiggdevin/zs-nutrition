import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/log-meal
 * Log a meal from the plan. Creates TrackedMeal and updates DailyLog.
 */
export async function POST(request: Request) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { planId, dayNumber, slot, mealName, calories, protein, carbs, fat, fiber, portion = 1.0 } = body;

    if (!planId || !mealName || calories === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify plan belongs to user
    const plan = await prisma.mealPlan.findFirst({
      where: { id: planId, userId: user.id },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Apply portion multiplier
    const kcal = Math.round(calories * portion);
    const proteinG = Math.round((protein || 0) * portion * 10) / 10;
    const carbsG = Math.round((carbs || 0) * portion * 10) / 10;
    const fatG = Math.round((fat || 0) * portion * 10) / 10;
    const fiberG = fiber ? Math.round(fiber * portion * 10) / 10 : null;

    // Create TrackedMeal with source='plan_meal'
    const trackedMeal = await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        mealPlanId: planId,
        loggedDate: dateOnly,
        mealSlot: slot || null,
        mealName,
        portion,
        kcal,
        proteinG,
        carbsG,
        fatG,
        fiberG,
        source: 'plan_meal',
        confidenceScore: 0.95,
      },
    });

    // Update or create DailyLog
    let dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: { userId: user.id, date: dateOnly },
      },
    });

    if (!dailyLog) {
      dailyLog = await prisma.dailyLog.create({
        data: {
          userId: user.id,
          date: dateOnly,
          targetKcal: plan.dailyKcalTarget || 2290,
          targetProteinG: plan.dailyProteinG || 172,
          targetCarbsG: plan.dailyCarbsG || 229,
          targetFatG: plan.dailyFatG || 76,
          actualKcal: kcal,
          actualProteinG: Math.round(proteinG),
          actualCarbsG: Math.round(carbsG),
          actualFatG: Math.round(fatG),
        },
      });
    } else {
      dailyLog = await prisma.dailyLog.update({
        where: { id: dailyLog.id },
        data: {
          actualKcal: dailyLog.actualKcal + kcal,
          actualProteinG: dailyLog.actualProteinG + Math.round(proteinG),
          actualCarbsG: dailyLog.actualCarbsG + Math.round(carbsG),
          actualFatG: dailyLog.actualFatG + Math.round(fatG),
        },
      });
    }

    // Calculate adherence score
    const targetKcal = dailyLog.targetKcal || 2290;
    const adherenceScore = targetKcal > 0
      ? Math.min(100, Math.round((dailyLog.actualKcal / targetKcal) * 100))
      : 0;

    await prisma.dailyLog.update({
      where: { id: dailyLog.id },
      data: { adherenceScore },
    });

    return NextResponse.json({
      success: true,
      trackedMeal: {
        id: trackedMeal.id,
        mealName: trackedMeal.mealName,
        mealSlot: trackedMeal.mealSlot,
        kcal: trackedMeal.kcal,
        proteinG: trackedMeal.proteinG,
        carbsG: trackedMeal.carbsG,
        fatG: trackedMeal.fatG,
        source: trackedMeal.source,
      },
      dailyLog: {
        actualKcal: dailyLog.actualKcal,
        actualProteinG: dailyLog.actualProteinG,
        actualCarbsG: dailyLog.actualCarbsG,
        actualFatG: dailyLog.actualFatG,
        targetKcal: dailyLog.targetKcal,
        targetProteinG: dailyLog.targetProteinG,
        targetCarbsG: dailyLog.targetCarbsG,
        targetFatG: dailyLog.targetFatG,
        adherenceScore,
      },
    });
  } catch (error) {
    safeLogError('Log meal error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
