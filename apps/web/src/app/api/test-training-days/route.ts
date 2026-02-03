import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

// POST: Set training days on user's active profile
// Body: { trainingDays: string[], goalKcal?: number }
export async function POST(req: Request) {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { trainingDays, goalKcal } = body;

    // Find or create active profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      // Create a default profile with training days
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          name: 'Test User',
          sex: 'male',
          age: 30,
          heightCm: 180,
          weightKg: 80,
          goalType: 'maintain',
          goalRate: 0,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          trainingDays: JSON.stringify(trainingDays || []),
          goalKcal: goalKcal || 2200,
          proteinTargetG: 165,
          carbsTargetG: 220,
          fatTargetG: 73,
          bmrKcal: 1806,
          tdeeKcal: 2799,
          isActive: true,
        },
      });
    } else {
      // Update existing profile
      const updateData: Record<string, unknown> = {
        trainingDays: JSON.stringify(trainingDays || []),
      };
      if (goalKcal !== undefined) {
        updateData.goalKcal = goalKcal;
      }
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: updateData,
      });
    }

    // Also update the meal plan's trainingBonusKcal if one exists
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId: user.id, isActive: true, status: 'active' },
    });
    if (activePlan) {
      await prisma.mealPlan.update({
        where: { id: activePlan.id },
        data: { trainingBonusKcal: 200 },
      });
    }

    // Also delete today's daily log so it gets recreated with new targets
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.dailyLog.deleteMany({
      where: {
        userId: user.id,
        date: today,
      },
    });

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      trainingDays: JSON.parse(profile.trainingDays),
      goalKcal: profile.goalKcal,
    });
  } catch (error) {
    safeLogError('Test training days error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get current training days info
export async function GET() {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = DAY_NAMES[new Date().getDay()];

    return NextResponse.json({
      todayDayName,
      todayDayOfWeek: new Date().getDay(),
      trainingDays: profile ? JSON.parse(profile.trainingDays) : [],
      goalKcal: profile?.goalKcal,
      profileExists: !!profile,
    });
  } catch (error) {
    safeLogError('Test training days GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
