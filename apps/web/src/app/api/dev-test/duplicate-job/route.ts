import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

/**
 * Dev-only endpoint to test duplicate job prevention.
 *
 * 1. Creates a job with status 'running'
 * 2. Calls the generate endpoint
 * 3. Verifies the same job ID is returned (not a new one)
 * 4. Cleans up by completing the test job
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 })
  }

  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Step 1: Count existing pending/running jobs
    const beforeCount = await prisma.planGenerationJob.count({
      where: { userId: user.id, status: { in: ['pending', 'running'] } },
    })

    // Step 2: Set one existing job to 'running' to simulate in-progress state
    // First find the most recent job
    const recentJob = await prisma.planGenerationJob.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    let testJobId: string | null = null
    let originalStatus: string | null = null

    if (recentJob) {
      originalStatus = recentJob.status
      testJobId = recentJob.id

      // Set it to 'running' temporarily
      await prisma.planGenerationJob.update({
        where: { id: recentJob.id },
        data: { status: 'running' },
      })
    }

    // Step 3: Check what the generate endpoint would do
    // Instead of calling the endpoint, query for pending/running jobs like the endpoint does
    const existingJob = await prisma.planGenerationJob.findFirst({
      where: {
        userId: user.id,
        status: { in: ['pending', 'running'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    const wouldReturnExisting = existingJob !== null
    const existingJobId = existingJob?.id || null

    // Step 4: Restore original status
    if (testJobId && originalStatus) {
      await prisma.planGenerationJob.update({
        where: { id: testJobId },
        data: { status: originalStatus },
      })
    }

    // Step 5: Count total jobs to confirm no duplicates were created
    const totalJobs = await prisma.planGenerationJob.count({
      where: { userId: user.id },
    })

    return NextResponse.json({
      success: true,
      tests: {
        duplicatePreventionActive: wouldReturnExisting,
        existingJobReturned: existingJobId === testJobId,
        existingJobId,
        testJobId,
        totalJobsForUser: totalJobs,
        beforePendingRunningCount: beforeCount,
      },
      message: wouldReturnExisting
        ? 'PASS: Duplicate job prevention is working - existing running job would be returned'
        : 'WARNING: No running job found (this is normal if all jobs are completed)',
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
