import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/test-empty-state
 * Creates a fresh user with completed onboarding but NO meal plans.
 * Sets the dev-user-id cookie so the dashboard shows the empty state.
 *
 * GET /api/test-empty-state?action=restore&userId=<previousUserId>
 * Restores the dev cookie to a previous user ID.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const devClerkUserId = `dev_empty_${uuidv4()}`
    const email = `empty-test-${Date.now()}@test.com`

    // Create user
    const user = await prisma.user.create({
      data: {
        clerkUserId: devClerkUserId,
        email,
      },
    })

    // Create completed onboarding
    await prisma.onboardingState.create({
      data: {
        userId: user.id,
        currentStep: 5,
        completed: true,
        stepData: JSON.stringify({
          name: 'Empty State Test User',
          sex: 'male',
          age: 30,
          heightCm: 180,
          weightKg: 80,
          goalType: 'maintain',
        }),
      },
    })

    // Create a basic profile
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: 'Empty State Test User',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        mealsPerDay: 3,
        snacksPerDay: 1,
        isActive: true,
        goalKcal: 2100,
        proteinTargetG: 160,
        carbsTargetG: 230,
        fatTargetG: 65,
      },
    })

    // Set dev cookie to this new user
    const cookieStore = await cookies()
    cookieStore.set('dev-user-id', user.id, {
      httpOnly: true,
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      email,
      message: 'Created user with completed onboarding, no meal plans. Dashboard should show empty state.',
    })
  } catch (error) {
    const err = error as Error
    safeLogError('test-empty-state error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const userId = url.searchParams.get('userId')

  if (action === 'restore' && userId) {
    const cookieStore = await cookies()
    cookieStore.set('dev-user-id', userId, {
      httpOnly: true,
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
    return NextResponse.json({ success: true, message: `Restored dev cookie to userId: ${userId}` })
  }

  return NextResponse.json({ error: 'Use POST to create empty-state test user, or GET ?action=restore&userId=X to restore' })
}
