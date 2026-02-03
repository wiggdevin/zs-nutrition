import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'
import { toLocalDay } from '@/lib/date-utils'

export async function GET(request: Request) {
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

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
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

    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = clientDayOfWeek ? parseInt(clientDayOfWeek, 10) : new Date().getDay();
    const todayDayName = DAY_NAMES[dayOfWeek];
    let trainingDays: string[] = [];
    try {
      trainingDays = activeProfile?.trainingDays ? JSON.parse(activeProfile.trainingDays) : [];
    } catch {
      trainingDays = [];
    }
    // Normalize: trainingDays may have short forms (Mon, Tue) or full names - check both
    const normalizedTrainingDays = trainingDays.map((d: string) => d.toLowerCase().trim());
    const isTrainingDay = normalizedTrainingDays.some((d: string) => {
      // Match full name or abbreviation (first 3 chars)
      return d === todayDayName || d === todayDayName.substring(0, 3) || todayDayName.startsWith(d);
    });

    // Get active meal plan
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true, status: 'active' },
      orderBy: { generatedAt: 'desc' },
    });

    // Get today's date (start of day) - use UTC midnight to match toLocalDay() storage
    const today = toLocalDay();
    const tomorrow = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + 1
    ));

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
    // Default targets from profile if available, else reasonable defaults
    const profileBaseKcal = activeProfile?.goalKcal || 2100;
    const profileBonusKcal = isTrainingDay ? 200 : 0;
    let dailyTargets = {
      kcal: profileBaseKcal + profileBonusKcal,
      proteinG: activeProfile?.proteinTargetG || 160,
      carbsG: activeProfile?.carbsTargetG || 230,
      fatG: activeProfile?.fatTargetG || 65,
    };

    if (activePlan) {
      planId = activePlan.id;
      // The plan's dailyKcalTarget might already include the training bonus
      // So we calculate the true base by subtracting the training bonus
      const planBonusKcal = activePlan.trainingBonusKcal || 200;
      const baseKcal = (activePlan.dailyKcalTarget || activeProfile?.goalKcal || 2100) - planBonusKcal;
      const bonus = isTrainingDay ? planBonusKcal : 0;
      dailyTargets = {
        kcal: baseKcal + bonus,
        proteinG: activePlan.dailyProteinG || 160,
        carbsG: activePlan.dailyCarbsG || 230,
        fatG: activePlan.dailyFatG || 65,
      };

      try {
        const validatedPlan = JSON.parse(activePlan.validatedPlan);
        // Get current day of week as plan day number (1=Mon, 7=Sun)
        const dow = today.getDay();
        const dayNumber = dow === 0 ? 7 : dow;

        const todayDay = validatedPlan.days?.find(
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
      } catch {
        // Failed to parse plan JSON
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
    const adherenceScore = dailyLog.adherenceScore !== null
      ? dailyLog.adherenceScore
      : (dailyLog.targetKcal && dailyLog.targetKcal > 0 && dailyLog.actualKcal > 0
        ? Math.min(100, Math.round((dailyLog.actualKcal / dailyLog.targetKcal) * 100))
        : 0);

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
    const weeklyAverageAdherence = weeklyLogs.length > 0
      ? Math.round(weeklyLogs.reduce((sum: number, l: { adherenceScore: number | null }) => sum + (l.adherenceScore || 0), 0) / weeklyLogs.length)
      : null;

    // Compute effective calorie target accounting for training day
    const effectiveKcalTarget = dailyLog.targetKcal || dailyTargets.kcal;

    // Check if user has completed onboarding / has an active profile
    const hasProfile = !!activeProfile;
    const onboardingState = await prisma.onboardingState.findUnique({
      where: { userId: user.id },
    });
    const hasCompletedOnboarding = onboardingState?.completed === true;

    return NextResponse.json({
      hasProfile,
      hasCompletedOnboarding,
      planId,
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
        protein: { current: Math.round(dailyLog.actualProteinG), target: dailyLog.targetProteinG || dailyTargets.proteinG },
        carbs: { current: Math.round(dailyLog.actualCarbsG), target: dailyLog.targetCarbsG || dailyTargets.carbsG },
        fat: { current: Math.round(dailyLog.actualFatG), target: dailyLog.targetFatG || dailyTargets.fatG },
      },
      adherenceScore,
      weeklyAverageAdherence,
      isTrainingDay,
      trainingDays: normalizedTrainingDays,
      trainingBonusKcal: isTrainingDay ? (activePlan?.trainingBonusKcal || 200) : 0,
      // Calculate true base goal by subtracting the training bonus from the plan's target
      // The plan's dailyKcalTarget might already include the training bonus, so we subtract it to get the base
      // We use the plan's bonus value since that's what was used during plan generation
      baseGoalKcal: activePlan
        ? (activePlan.dailyKcalTarget || 2100) - (activePlan.trainingBonusKcal || 200)
        : (activeProfile?.goalKcal || 2100),
    });
  } catch (error) {
    safeLogError('Dashboard data error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again later.' }, { status: 500 });
  }
}
