import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

/**
 * POST /api/test-update-adherence
 * Test endpoint to update adherence scores for existing DailyLogs.
 * Only used in development for testing weekly average display.
 */
export async function POST(request: Request) {
  const clerkId = await getClerkUserId()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { date, adherenceScore } = body

    if (!date || typeof adherenceScore !== 'number') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Parse date to UTC midnight
    const dateOnly = new Date(date)
    dateOnly.setUTCHours(0, 0, 0, 0)

    // Update the DailyLog
    const updated = await prisma.dailyLog.updateMany({
      where: {
        userId: user.id,
        date: dateOnly,
      },
      data: {
        adherenceScore,
      },
    })

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
      date,
      adherenceScore,
    })
  } catch (error) {
    console.error('Error updating adherence:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
