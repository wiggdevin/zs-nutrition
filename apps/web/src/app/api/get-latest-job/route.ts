import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    // Dev mode: get user from dev-user-id cookie
    const devUserId = request.cookies.get('dev-user-id')?.value

    if (!devUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the most recent plan generation job
    const job = await prisma.planGenerationJob.findFirst({
      where: { userId: devUserId },
      orderBy: { createdAt: 'desc' },
    })

    if (!job) {
      return NextResponse.json({ error: 'No jobs found' }, { status: 404 })
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      currentAgent: job.currentAgent,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
