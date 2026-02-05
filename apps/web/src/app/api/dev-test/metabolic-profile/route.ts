import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClerkUserId } from '@/lib/auth';

// Dev-only: get current user's metabolic profile data (to verify recalculation)
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

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
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = user.profiles[0];
  if (!profile) {
    return NextResponse.json({ error: 'No profile found' }, { status: 404 });
  }

  // Parse JSON fields
  let trainingDays: string[] = [];
  try {
    trainingDays = JSON.parse(profile.trainingDays || '[]');
  } catch {
    trainingDays = [];
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      activityLevel: profile.activityLevel,
      trainingDays,
      // Metabolic targets
      bmrKcal: profile.bmrKcal,
      tdeeKcal: profile.tdeeKcal,
      goalKcal: profile.goalKcal,
      proteinTargetG: profile.proteinTargetG,
      carbsTargetG: profile.carbsTargetG,
      fatTargetG: profile.fatTargetG,
    },
  });
}
