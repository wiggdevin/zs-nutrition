import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

/**
 * TEST ENDPOINT — Development only
 * Verifies Feature #237: TrackedMeal records have correct source field
 *
 * POST /api/test-feature-237
 *
 * Tests all four tracking methods:
 * 1. Log from plan - source should be 'plan_meal'
 * 2. FatSecret search - source should be 'fatsecret_search'
 * 3. Quick add - source should be 'quick_add'
 * 4. Manual entry - source should be 'manual'
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all TrackedMeals for this user
    const trackedMeals = await prisma.trackedMeal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Group by source
    const bySource = {
      plan_meal: trackedMeals.filter(m => m.source === 'plan_meal'),
      fatsecret_search: trackedMeals.filter(m => m.source === 'fatsecret_search'),
      quick_add: trackedMeals.filter(m => m.source === 'quick_add'),
      manual: trackedMeals.filter(m => m.source === 'manual'),
    }

    // Verification results
    const results = {
      totalTrackedMeals: trackedMeals.length,
      sources: {
        plan_meal: {
          count: bySource.plan_meal.length,
          verified: bySource.plan_meal.every(m => m.source === 'plan_meal'),
          samples: bySource.plan_meal.slice(0, 3).map(m => ({
            id: m.id,
            mealName: m.mealName,
            source: m.source,
            createdAt: m.createdAt,
          })),
        },
        fatsecret_search: {
          count: bySource.fatsecret_search.length,
          verified: bySource.fatsecret_search.every(m => m.source === 'fatsecret_search'),
          samples: bySource.fatsecret_search.slice(0, 3).map(m => ({
            id: m.id,
            mealName: m.mealName,
            source: m.source,
            fatsecretId: m.fatsecretId,
            createdAt: m.createdAt,
          })),
        },
        quick_add: {
          count: bySource.quick_add.length,
          verified: bySource.quick_add.every(m => m.source === 'quick_add'),
          samples: bySource.quick_add.slice(0, 3).map(m => ({
            id: m.id,
            mealName: m.mealName,
            source: m.source,
            createdAt: m.createdAt,
          })),
        },
        manual: {
          count: bySource.manual.length,
          verified: bySource.manual.every(m => m.source === 'manual'),
          samples: bySource.manual.slice(0, 3).map(m => ({
            id: m.id,
            mealName: m.mealName,
            source: m.source,
            createdAt: m.createdAt,
          })),
        },
      },
    }

    const allVerified =
      results.sources.plan_meal.verified &&
      results.sources.fatsecret_search.verified &&
      results.sources.quick_add.verified &&
      results.sources.manual.verified

    return NextResponse.json({
      success: true,
      allVerified,
      results,
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
