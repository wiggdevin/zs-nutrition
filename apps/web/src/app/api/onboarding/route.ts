import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

async function getOrCreateUser(clerkUserId: string) {
  let user = await prisma.user.findUnique({ where: { clerkUserId } })
  if (!user) {
    user = await prisma.user.create({
      data: { clerkUserId, email: `${clerkUserId}@placeholder.com` },
    })
  }
  return user
}

// GET - fetch onboarding state
export async function GET() {
  const clerkUserId = await getClerkUserId()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getOrCreateUser(clerkUserId)
  let onboarding = await prisma.onboardingState.findUnique({
    where: { userId: user.id },
  })

  if (!onboarding) {
    onboarding = await prisma.onboardingState.create({
      data: { userId: user.id, currentStep: 1, stepData: '{}' },
    })
  }

  return NextResponse.json({
    currentStep: onboarding.currentStep,
    completed: onboarding.completed,
    stepData: JSON.parse(onboarding.stepData),
  })
}

// POST - update onboarding step
export async function POST(request: NextRequest) {
  const clerkUserId = await getClerkUserId()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }
  const { step, data, complete } = body

  const user = await getOrCreateUser(clerkUserId)

  let onboarding = await prisma.onboardingState.findUnique({
    where: { userId: user.id },
  })

  if (!onboarding) {
    onboarding = await prisma.onboardingState.create({
      data: { userId: user.id, currentStep: 1, stepData: '{}' },
    })
  }

  // Merge new step data with existing
  const existingData = JSON.parse(onboarding.stepData)
  const mergedData = { ...existingData, ...data }

  if (complete) {
    // Mark onboarding as completed and create UserProfile
    await prisma.onboardingState.update({
      where: { userId: user.id },
      data: {
        currentStep: 6,
        completed: true,
        stepData: JSON.stringify(mergedData),
      },
    })

    // Convert heights/weights for profile creation
    const heightCm = mergedData.heightCm || (mergedData.heightFeet || 0) * 30.48 + (mergedData.heightInches || 0) * 2.54
    const weightKg = mergedData.weightKg || (mergedData.weightLbs || 0) * 0.453592

    // Create user profile from onboarding data
    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: mergedData.name || 'User',
        sex: mergedData.sex || 'male',
        age: mergedData.age || 25,
        heightCm,
        weightKg,
        bodyFatPercent: mergedData.bodyFatPercent || null,
        goalType: mergedData.goalType || 'maintain',
        goalRate: mergedData.goalRate || 0,
        activityLevel: mergedData.activityLevel || 'moderately_active',
        dietaryStyle: mergedData.dietaryStyle || 'omnivore',
        allergies: JSON.stringify(mergedData.allergies || []),
        exclusions: JSON.stringify(mergedData.exclusions || []),
        cuisinePrefs: JSON.stringify(mergedData.cuisinePreferences || []),
        trainingDays: JSON.stringify(mergedData.trainingDays || []),
        trainingTime: mergedData.trainingTime || null,
        mealsPerDay: mergedData.mealsPerDay || 3,
        snacksPerDay: mergedData.snacksPerDay || 1,
        cookingSkill: mergedData.cookingSkill || 5,
        prepTimeMax: mergedData.prepTimeMax || 30,
        macroStyle: mergedData.macroStyle || 'balanced',
        isActive: true,
      },
    })

    return NextResponse.json({
      completed: true,
      profileId: profile.id,
      redirect: '/generate',
    })
  }

  // Just update the step
  await prisma.onboardingState.update({
    where: { userId: user.id },
    data: {
      currentStep: step,
      stepData: JSON.stringify(mergedData),
    },
  })

  return NextResponse.json({
    currentStep: step,
    stepData: mergedData,
  })
}
