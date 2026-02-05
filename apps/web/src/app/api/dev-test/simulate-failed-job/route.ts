import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

/**
 * Dev-only endpoint to simulate a failed plan generation job.
 *
 * This creates a job with status 'failed' and an error message,
 * then redirects to the generate page where the SSE stream
 * will pick up the failed status and display the error UI.
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

    // Create a failed job with a test error message
    const jobId = uuidv4()
    const failedJob = await prisma.planGenerationJob.create({
      data: {
        id: jobId,
        userId: user.id,
        status: 'failed',
        currentAgent: 3, // Simulate failure at Agent 3 (Recipe Curator)
        intakeData: JSON.stringify({
          test: true,
          message: 'This is a simulated failure for testing',
        }),
        error: 'AI service temporarily unavailable. The Recipe Curator agent could not generate meal ideas. Please try again.',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      jobId: failedJob.id,
      status: 'failed',
      error: failedJob.error,
      currentAgent: failedJob.currentAgent,
      streamUrl: `/api/plan-stream/${failedJob.id}`,
      testPageUrl: `/test-feature-159?jobId=${failedJob.id}`,
      message: 'Failed job created. Test the error UI by:',
      instructions: [
        '1. Visit the test page: ' + `/test-feature-159?jobId=${failedJob.id}`,
        '2. Or manually navigate to: /generate',
        '3. The SSE stream will emit the failed status',
        '4. Verify the error message displays correctly',
        '5. Verify the retry button appears and works',
      ],
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
