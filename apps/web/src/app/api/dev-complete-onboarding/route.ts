import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDevMode } from '@/lib/auth'

/**
 * DEV ONLY: Complete onboarding for the dev user
 * POST /api/dev-complete-onboarding
 */
export async function POST() {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const clerkUserId = 'dev_user_001'
    const user = await prisma.user.findUnique({ where: { clerkUserId } })

    if (!user) {
      return NextResponse.json({ error: 'Dev user not found' }, { status: 404 })
    }

    await prisma.onboardingState.upsert({
      where: { userId: user.id },
      update: { completed: true, currentStep: 6 },
      create: {
        userId: user.id,
        currentStep: 6,
        completed: true,
        stepData: "{}"
      }
    })

    return NextResponse.json({ success: true, message: 'Onboarding completed' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
