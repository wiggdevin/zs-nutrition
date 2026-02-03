import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue'

/**
 * TEST ENDPOINT — Development only
 * Directly tests the plan generation flow without requiring Clerk auth.
 *
 * POST /api/test-generate
 *
 * Verifies Feature #153: "Plan generation creates BullMQ job"
 * - Creates PlanGenerationJob record in DB with status 'pending'
 * - Enqueues BullMQ job
 * - Returns jobId immediately (fast response)
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const startTime = Date.now()

  try {
    // Ensure a test user exists
    let testUser = await prisma.user.findUnique({
      where: { clerkUserId: 'test_user_feature_153' },
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          clerkUserId: 'test_user_feature_153',
          email: 'test-feature-153@test.dev',
        },
      })
    }

    // Sample intake data
    const intakeData = {
      name: 'Test User',
      sex: 'male',
      age: 30,
      heightFeet: 5,
      heightInches: 10,
      weightLbs: 180,
      goalType: 'cut',
      goalRate: 1,
      activityLevel: 'moderately_active',
      trainingDays: ['monday', 'wednesday', 'friday'],
      dietaryStyle: 'omnivore',
      allergies: [],
      exclusions: [],
      cuisinePreferences: ['american', 'italian'],
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingSkill: 5,
      prepTimeMaxMin: 30,
      macroStyle: 'balanced',
      planDurationDays: 7,
    }

    // Step 1: Create PlanGenerationJob in DB
    // SQLite stores Json fields as strings, so we stringify the intake data
    const job = await prisma.planGenerationJob.create({
      data: {
        userId: testUser.id,
        status: 'pending',
        intakeData: JSON.stringify(intakeData),
      },
    })

    // Step 2: Enqueue BullMQ job
    const bullmqJobData: PlanGenerationJobData = {
      jobId: job.id,
      userId: testUser.id,
      intakeData: intakeData as Record<string, unknown>,
    }

    const bullmqJob = await planGenerationQueue.add(
      'generate-plan',
      bullmqJobData,
      { jobId: job.id }
    )

    const responseTime = Date.now() - startTime

    // Step 3: Verify job was created in DB
    const dbJob = await prisma.planGenerationJob.findUnique({
      where: { id: job.id },
    })

    // Return verification results
    return NextResponse.json({
      success: true,
      jobId: job.id,
      verification: {
        jobIdReturned: !!job.id,
        dbRecordCreated: !!dbJob,
        dbStatus: dbJob?.status,
        bullmqJobId: bullmqJob?.id || job.id,
        bullmqEnqueued: !!bullmqJob,
        responseTimeMs: responseTime,
        fastResponse: responseTime < 2000, // Should be well under 2 seconds
      },
    })
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test-generate
 * Returns info about existing test jobs for verification.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const jobs = await prisma.planGenerationJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userId: true,
        status: true,
        currentAgent: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      totalJobs: jobs.length,
      jobs,
    })
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
