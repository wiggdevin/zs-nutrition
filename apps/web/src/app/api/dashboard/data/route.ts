import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { toLocalDay } from '@/lib/date-utils';
import { decompressJson } from '@/lib/compression';
import { getTrainingDayBonus } from '@/lib/metabolic-utils';

export async function GET(request: Request) {
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

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the user's active profile to check training days
    const activeProfile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Determine if today is a training day
    // IMPORTANT: Use client-provided dayOfWeek to respect user's timezone
    // Fall back to server day if not provided (backward compatibility)
    const { searchParams } = new URL(request.url);
    const clientDayOfWeek = searchParams.get('dayOfWeek');

    const DAY_NAMES = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayOfWeek = clientDayOfWeek ? parseInt(clientDayOfWeek, 10) : new Date().getDay();
    const todayDayName = DAY_NAMES[dayOfWeek];
    // trainingDays is now a Prisma Json type - no parsing needed
    const trainingDays: string[] = (
      Array.isArray(activeProfile?.trainingDays) ? activeProfile.trainingDays : []
    ) as string[];
    // Normalize: trainingDays may have short forms (Mon, Tue) or full names - check both
    const normalizedTrainingDays = trainingDays.map((d: string) => d.toLowerCase().trim());
    const isTrainingDay = normalizedTrainingDays.some((d: string) => {
      // Match full name or abbreviation (first 3 chars)
      return d === todayDayName || d === todayDayName.substring(0, 3) || todayDayName.startsWith(d);
    });

    // Get active meal plan (exclude soft-deleted)
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true, status: 'active', deletedAt: null },
      orderBy: { generatedAt: 'desc' },
    });

    // Get today's date (start of day) - use UTC midnight to match toLocalDay() storage
    const today = toLocalDay();
    const tomorrow = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)
    );

    // Figure out today's meals from the plan
    let todayPlanMeals: Array<{
      slot: string;
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      prepTime: string;
      dayNumber: number;
      confidenceLevel: string;
    }> = [];

    let planId: string | null = null;
    // Use UserProfile as the single source of truth for targets
    const baseKcal = activeProfile?.goalKcal || 2100;
    const trainingBonusKcal =
      activePlan?.trainingBonusKcal ||
      (activeProfile?.tdeeKcal ? getTrainingDayBonus(activeProfile.tdeeKcal) : 200);
    const bonus = isTrainingDay ? trainingBonusKcal : 0;

    const dailyTargets = {
      kcal: baseKcal + bonus,
      proteinG: activeProfile?.proteinTargetG || 160,
      carbsG: activeProfile?.carbsTargetG || 230,
      fatG: activeProfile?.fatTargetG || 65,
    };

    if (activePlan) {
      planId = activePlan.id;

      // Decompress validatedPlan (handles both compressed and legacy uncompressed data)
      const validatedPlan = decompressJson<{
        days?: Array<{ dayNumber: number; meals?: Array<any> }>;
      } | null>(activePlan.validatedPlan);

      // If validatedPlan is null or has no valid days, treat as no plan
      if (!validatedPlan?.days || validatedPlan.days.length === 0) {
        planId = null;
      }

      // Get current day of week as plan day number (1=Mon, 7=Sun)
      const dow = today.getDay();
      const dayNumber = dow === 0 ? 7 : dow;

      const todayDay = validatedPlan?.days?.find(
        (d: { dayNumber: number }) => d.dayNumber === dayNumber
      );

      if (todayDay && todayDay.meals) {
        todayPlanMeals = todayDay.meals.map(
          (m: {
            slot: string;
            name: string;
            nutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number };
            prepTimeMin: number;
            confidenceLevel?: string;
          }) => ({
            slot: m.slot,
            name: m.name,
            calories: m.nutrition.kcal,
            protein: m.nutrition.proteinG,
            carbs: m.nutrition.carbsG,
            fat: m.nutrition.fatG,
            prepTime: `${m.prepTimeMin} min`,
            dayNumber,
            confidenceLevel: m.confidenceLevel || 'ai_estimated',
          })
        );
      }
    }

    // Get today's tracked meals
    const trackedMeals = await prisma.trackedMeal.findMany({
      where: {
        userId: user.id,
        loggedDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get or create today's daily log
    let dailyLog = await prisma.dailyLog.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    if (!dailyLog) {
      dailyLog = await prisma.dailyLog.create({
        data: {
          userId: user.id,
          date: today,
          targetKcal: dailyTargets.kcal,
          targetProteinG: dailyTargets.proteinG,
          targetCarbsG: dailyTargets.carbsG,
          targetFatG: dailyTargets.fatG,
          actualKcal: 0,
          actualProteinG: 0,
          actualCarbsG: 0,
          actualFatG: 0,
        },
      });
    } else {
      // Update targets if they don't match current calculated targets
      // This handles the case where training day status changes or meal plan is updated
      const needsUpdate =
        dailyLog.targetKcal !== dailyTargets.kcal ||
        dailyLog.targetProteinG !== dailyTargets.proteinG ||
        dailyLog.targetCarbsG !== dailyTargets.carbsG ||
        dailyLog.targetFatG !== dailyTargets.fatG;

      if (needsUpdate) {
        dailyLog = await prisma.dailyLog.update({
          where: { id: dailyLog.id },
          data: {
            targetKcal: dailyTargets.kcal,
            targetProteinG: dailyTargets.proteinG,
            targetCarbsG: dailyTargets.carbsG,
            targetFatG: dailyTargets.fatG,
          },
        });
      }
    }

    // Use the stored weighted adherence score from DailyLog (calculated by meal logging endpoints)
    // Falls back to a simple calorie-based calculation if no stored score exists
    const adherenceScore =
      dailyLog.adherenceScore !== null
        ? dailyLog.adherenceScore
        : dailyLog.targetKcal && dailyLog.targetKcal > 0 && dailyLog.actualKcal > 0
          ? Math.min(100, Math.round((dailyLog.actualKcal / dailyLog.targetKcal) * 100))
          : 0;

    // Calculate weekly average adherence from last 7 days of DailyLogs
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6); // 7 days including today
    const weeklyLogs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: { gte: weekAgo, lte: tomorrow },
        adherenceScore: { not: null },
      },
      select: { adherenceScore: true },
    });
    const weeklyAverageAdherence =
      weeklyLogs.length > 0
        ? Math.round(
            weeklyLogs.reduce(
              (sum: number, l: { adherenceScore: number | null }) => sum + (l.adherenceScore || 0),
              0
            ) / weeklyLogs.length
          )
        : null;

    // Compute effective calorie target accounting for training day
    const effectiveKcalTarget = dailyLog.targetKcal || dailyTargets.kcal;

    // Check if user has completed onboarding / has an active profile
    const hasProfile = !!activeProfile;
    const onboardingState = await prisma.onboardingState.findUnique({
      where: { userId: user.id },
    });
    const hasCompletedOnboarding = onboardingState?.completed === true;

    // Self-healing: if onboarding is marked completed but no profile exists,
    // reset the onboarding state so the user can re-complete
    if (!activeProfile && hasCompletedOnboarding && onboardingState) {
      await prisma.onboardingState.update({
        where: { userId: user.id },
        data: { completed: false },
      });
    }

    // Compute plan staleness
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let isPlanStale = false;
    let staleReason: 'plan_age' | 'profile_changed' | null = null;
    const planGeneratedAt = activePlan?.generatedAt?.toISOString() ?? null;

    if (activePlan && activeProfile) {
      const generatedTime = activePlan.generatedAt?.getTime() ?? 0;
      if (Date.now() - generatedTime > SEVEN_DAYS_MS) {
        isPlanStale = true;
        staleReason = 'plan_age';
      } else if (activeProfile.updatedAt > (activePlan.generatedAt ?? new Date(0))) {
        isPlanStale = true;
        staleReason = 'profile_changed';
      }
    }

    return NextResponse.json({
      hasProfile,
      hasCompletedOnboarding,
      planId,
      planGeneratedAt,
      isPlanStale,
      staleReason,
      todayPlanMeals,
      trackedMeals: trackedMeals.map((tm: any) => ({
        id: tm.id,
        name: tm.mealName,
        calories: tm.kcal,
        protein: tm.proteinG,
        carbs: tm.carbsG,
        fat: tm.fatG,
        portion: tm.portion || 1.0,
        source: tm.source,
        mealSlot: tm.mealSlot,
        confidenceScore: tm.confidenceScore,
        createdAt: tm.createdAt.toISOString(),
      })),
      macros: {
        calories: { current: dailyLog.actualKcal, target: effectiveKcalTarget },
        protein: {
          current: Math.round(dailyLog.actualProteinG),
          target: dailyLog.targetProteinG || dailyTargets.proteinG,
        },
        carbs: {
          current: Math.round(dailyLog.actualCarbsG),
          target: dailyLog.targetCarbsG || dailyTargets.carbsG,
        },
        fat: {
          current: Math.round(dailyLog.actualFatG),
          target: dailyLog.targetFatG || dailyTargets.fatG,
        },
      },
      adherenceScore,
      weeklyAverageAdherence,
      isTrainingDay,
      trainingDays: normalizedTrainingDays,
      trainingBonusKcal: isTrainingDay ? trainingBonusKcal : 0,
      baseGoalKcal: activeProfile?.goalKcal || 2100,
    });
  } catch (error) {
    logger.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
