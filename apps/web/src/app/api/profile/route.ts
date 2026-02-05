import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

// GET - Retrieve current user's profile
export async function GET() {
  try {
    let clerkUserId: string
    let dbUserId: string
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Account is deactivated' ? 403 : 401
      return NextResponse.json({ error: message }, { status })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        profiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        onboarding: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = user.profiles[0] || null;

    return NextResponse.json({
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
      },
      profile: profile ? {
        id: profile.id,
        name: profile.name,
        sex: profile.sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatPercent: profile.bodyFatPercent,
        goalType: profile.goalType,
        goalRate: profile.goalRate,
        activityLevel: profile.activityLevel,
        dietaryStyle: profile.dietaryStyle,
        allergies: JSON.parse(profile.allergies),
        exclusions: JSON.parse(profile.exclusions),
        cuisinePrefs: JSON.parse(profile.cuisinePrefs),
        trainingDays: JSON.parse(profile.trainingDays),
        trainingTime: profile.trainingTime,
        mealsPerDay: profile.mealsPerDay,
        snacksPerDay: profile.snacksPerDay,
        cookingSkill: profile.cookingSkill,
        prepTimeMax: profile.prepTimeMax,
        macroStyle: profile.macroStyle,
        bmrKcal: profile.bmrKcal,
        tdeeKcal: profile.tdeeKcal,
        goalKcal: profile.goalKcal,
        proteinTargetG: profile.proteinTargetG,
        carbsTargetG: profile.carbsTargetG,
        fatTargetG: profile.fatTargetG,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
      } : null,
      onboarding: user.onboarding ? {
        completed: user.onboarding.completed,
        currentStep: user.onboarding.currentStep,
      } : null,
    });
  } catch (error) {
    safeLogError('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
