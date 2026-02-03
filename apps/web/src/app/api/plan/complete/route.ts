import { NextRequest, NextResponse } from 'next/server'
import { savePlanToDatabase, type PlanCompletionData } from '@/lib/save-plan'
import { isDevMode } from '@/lib/auth'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/plan/complete
 *
 * Called by the BullMQ worker when a plan generation job completes successfully.
 * Protected by an internal API secret (INTERNAL_API_SECRET env var).
 * In dev mode, the secret check is skipped since the generate endpoint
 * calls savePlanToDatabase directly.
 */
export async function POST(request: NextRequest) {
  // In production, require internal API secret
  if (!isDevMode) {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.INTERNAL_API_SECRET

    if (!expectedSecret) {
      console.error('[/api/plan/complete] INTERNAL_API_SECRET not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    let body: PlanCompletionData
    try {
      body = await request.json() as PlanCompletionData
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    if (!body.jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    if (!body.planData || !body.planData.days) {
      return NextResponse.json({ error: 'planData with days array is required' }, { status: 400 })
    }

    const result = await savePlanToDatabase(body)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      planId: result.planId,
    })
  } catch (error) {
    safeLogError('[/api/plan/complete] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
