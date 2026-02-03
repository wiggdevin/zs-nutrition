import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';
import { safeLogError } from '@/lib/safe-logger';

// GET - Retrieve current user's profile
export async function GET() {
  try {
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
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
