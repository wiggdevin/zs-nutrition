import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';

async function getOrCreateUser(clerkUserId: string) {
  let user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    user = await prisma.user.create({
      data: { clerkUserId, email: `${clerkUserId}@placeholder.com` },
    });
  }
  return user;
}

// GET - fetch onboarding state
export async function GET() {
  let clerkUserId: string;
  let _dbUserId: string;
  try {
    ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Account is deactivated' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const user = await getOrCreateUser(clerkUserId);
  const onboarding = await prisma.onboardingState.findUnique({
    where: { userId: user.id },
  });

  // If no onboarding state exists, check if user has a profile
  // (which means onboarding was completed and cleaned up)
  if (!onboarding) {
    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (profile) {
      // User has completed onboarding (state was cleaned up)
      return NextResponse.json({
        currentStep: 7,
        completed: true,
        stepData: {},
      });
    }

    // No profile and no onboarding state - start fresh onboarding
    const newOnboarding = await prisma.onboardingState.create({
      data: { userId: user.id, currentStep: 1, stepData: {} },
    });
    return NextResponse.json({
      currentStep: newOnboarding.currentStep,
      completed: newOnboarding.completed,
      stepData: newOnboarding.stepData,
    });
  }

  // Recovery check: if onboarding is marked completed but no UserProfile exists,
  // reset completed to false so user can re-complete from their saved step data
  if (onboarding.completed) {
    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!profile) {
      await prisma.onboardingState.update({
        where: { userId: user.id },
        data: { completed: false },
      });
      return NextResponse.json({
        currentStep: onboarding.currentStep,
        completed: false,
        stepData: onboarding.stepData,
      });
    }
  }

  return NextResponse.json({
    currentStep: onboarding.currentStep,
    completed: onboarding.completed,
    stepData: onboarding.stepData,
  });
}

// POST - update onboarding step
export async function POST(request: NextRequest) {
  let clerkUserId: string;
  let _dbUserId: string;
  try {
    ({ clerkUserId, dbUserId: _dbUserId } = await requireActiveUser());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Account is deactivated' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { step, data, complete } = body;

  const user = await getOrCreateUser(clerkUserId);

  let onboarding = await prisma.onboardingState.findUnique({
    where: { userId: user.id },
  });

  if (!onboarding) {
    onboarding = await prisma.onboardingState.create({
      data: { userId: user.id, currentStep: 1, stepData: {} },
    });
  }

  // Merge new step data with existing (stepData is already an object from Prisma Json type)
  const existingData = (onboarding.stepData as Record<string, unknown>) || {};
  const mergedData = { ...existingData, ...data };

  if (complete) {
    // Save step data as backup — profile creation is handled by /api/onboarding/complete
    await prisma.onboardingState.update({
      where: { userId: user.id },
      data: {
        currentStep: 6,
        completed: true,
        stepData: mergedData,
      },
    });

    return NextResponse.json({
      completed: true,
      redirect: '/generate',
    });
  }

  // Just update the step
  await prisma.onboardingState.update({
    where: { userId: user.id },
    data: {
      currentStep: step,
      stepData: mergedData,
    },
  });

  return NextResponse.json({
    currentStep: step,
    stepData: mergedData,
  });
}
