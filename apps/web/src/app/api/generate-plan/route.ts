import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';

// POST - create a plan generation job
export async function POST() {
  let clerkUserId: string;

  try {
    const activeUser = await requireActiveUser();
    clerkUserId = activeUser.clerkUserId;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Account is deactivated') {
        return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      profiles: { where: { isActive: true }, take: 1 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = user.profiles[0];
  if (!profile) {
    return NextResponse.json(
      { error: 'No active profile found. Please complete onboarding first.' },
      { status: 400 }
    );
  }

  // Create a plan generation job
  const job = await prisma.planGenerationJob.create({
    data: {
      userId: user.id,
      status: 'pending',
      intakeData: JSON.stringify({
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
        allergies:
          typeof profile.allergies === 'string'
            ? JSON.parse(profile.allergies)
            : (profile.allergies ?? []),
        exclusions:
          typeof profile.exclusions === 'string'
            ? JSON.parse(profile.exclusions)
            : (profile.exclusions ?? []),
        cuisinePreferences:
          typeof profile.cuisinePrefs === 'string'
            ? JSON.parse(profile.cuisinePrefs)
            : (profile.cuisinePrefs ?? []),
        trainingDays:
          typeof profile.trainingDays === 'string'
            ? JSON.parse(profile.trainingDays)
            : (profile.trainingDays ?? []),
        trainingTime: profile.trainingTime,
        mealsPerDay: profile.mealsPerDay,
        snacksPerDay: profile.snacksPerDay,
        cookingSkill: profile.cookingSkill,
        prepTimeMaxMin: profile.prepTimeMax,
        macroStyle: profile.macroStyle,
      }),
    },
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
  });
}
