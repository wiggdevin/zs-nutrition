import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/account/deactivate
 *
 * Deactivates the current user's account by setting isActive=false.
 * Data is preserved (soft delete) - no records are orphaned or deleted.
 * The user's session is not terminated here; the client should sign out after.
 */
export async function POST() {
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

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is already deactivated' }, { status: 400 })
    }

    // Soft-deactivate: set isActive=false, record deactivation timestamp
    // All related data (profiles, plans, logs, tracked meals, scans, jobs)
    // remain intact with their foreign keys - NO orphaned records.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    })

    // Also deactivate any active meal plans (so they don't show up if account is ever reactivated)
    await prisma.mealPlan.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, status: 'replaced' },
    })

    return NextResponse.json({
      success: true,
      message: 'Account deactivated successfully. All data has been preserved.',
    })
  } catch (error) {
    safeLogError('Account deactivation error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
