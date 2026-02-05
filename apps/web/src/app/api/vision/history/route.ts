import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/vision/history
 *
 * Get user's food scan history
 */
export async function GET(request: Request) {
  try {
    let clerkUserId: string
    let dbUserId: string
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Account is deactivated' ? 403 : 401
      return NextResponse.json({ error: message }, { status })
    }

    // Use clerkUserId as userId for foodScan queries (foodScan stores Clerk user IDs)
    const userId = clerkUserId

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch food scans
    const scans = await prisma.foodScan.findMany({
      where: {
        userId,
        status: 'completed', // Only show completed scans
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Parse JSON fields and format response
    const formattedScans = scans.map(scan => ({
      id: scan.id,
      status: scan.status,
      scanType: scan.scanType,
      analysisResult: scan.analysisResult ? JSON.parse(scan.analysisResult) : null,
      userConfirmed: scan.userConfirmed,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      // Check if this scan has been logged as a meal
      hasLoggedMeal: scan.userConfirmed,
    }))

    // Get total count
    const totalCount = await prisma.foodScan.count({
      where: {
        userId,
        status: 'completed',
      },
    })

    return NextResponse.json({
      scans: formattedScans,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/vision/history:', error)

    const message = error instanceof Error ? error.message : 'Failed to fetch history'

    return NextResponse.json(
      { error: 'Failed to fetch history', message },
      { status: 500 }
    )
  }
}
