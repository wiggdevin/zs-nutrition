import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'
import { calculateAdherenceScore } from '@/lib/adherence'
import { safeLogError } from '@/lib/safe-logger'

/**
 * POST /api/test-adherence
 * Test endpoint to set up adherence score scenarios.
 * Accepts: { scenario: 'exact_match' | 'half_match' | 'clear' }
 *
 * 'exact_match': Sets actuals = targets (score should be ~100)
 * 'half_match': Sets actuals = 50% of targets (score should reflect gap)
 * 'clear': Removes today's daily log and tracked meals
 */
export async function POST(request: Request) {
  try {
    const clerkUserId = await getClerkUserId()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { scenario } = body

    const today = new Date()
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    // Get user profile targets
    const profile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
      select: { goalKcal: true, proteinTargetG: true, carbsTargetG: true, fatTargetG: true },
    })

    const targets = {
      kcal: profile?.goalKcal || 2000,
      proteinG: profile?.proteinTargetG || 150,
      carbsG: profile?.carbsTargetG || 200,
      fatG: profile?.fatTargetG || 65,
    }

    if (scenario === 'clear') {
      // Delete tracked meals for today
      await prisma.trackedMeal.deleteMany({
        where: { userId: user.id, loggedDate: dateOnly },
      })
      // Delete daily log for today
      await prisma.dailyLog.deleteMany({
        where: { userId: user.id, date: dateOnly },
      })
      return NextResponse.json({ success: true, scenario: 'clear', message: 'Cleared today\'s data' })
    }

    // First clear existing data
    await prisma.trackedMeal.deleteMany({
      where: { userId: user.id, loggedDate: dateOnly },
    })
    await prisma.dailyLog.deleteMany({
      where: { userId: user.id, date: dateOnly },
    })

    let actualMultiplier = 1.0
    if (scenario === 'exact_match') {
      actualMultiplier = 1.0
    } else if (scenario === 'half_match') {
      actualMultiplier = 0.5
    } else {
      return NextResponse.json({ error: 'Invalid scenario. Use: exact_match, half_match, or clear' }, { status: 400 })
    }

    const actuals = {
      kcal: Math.round(targets.kcal * actualMultiplier),
      proteinG: Math.round(targets.proteinG * actualMultiplier),
      carbsG: Math.round(targets.carbsG * actualMultiplier),
      fatG: Math.round(targets.fatG * actualMultiplier),
    }

    // Create a tracked meal that matches
    await prisma.trackedMeal.create({
      data: {
        userId: user.id,
        mealPlanId: null,
        loggedDate: dateOnly,
        mealSlot: 'breakfast',
        mealName: `Adherence Test (${scenario})`,
        portion: 1.0,
        kcal: actuals.kcal,
        proteinG: actuals.proteinG,
        carbsG: actuals.carbsG,
        fatG: actuals.fatG,
        fiberG: null,
        source: 'manual',
        confidenceScore: null,
      },
    })

    // Create daily log with targets and actuals
    const dailyLog = await prisma.dailyLog.create({
      data: {
        userId: user.id,
        date: dateOnly,
        targetKcal: targets.kcal,
        targetProteinG: targets.proteinG,
        targetCarbsG: targets.carbsG,
        targetFatG: targets.fatG,
        actualKcal: actuals.kcal,
        actualProteinG: actuals.proteinG,
        actualCarbsG: actuals.carbsG,
        actualFatG: actuals.fatG,
      },
    })

    // Calculate and save adherence score
    const adherenceScore = calculateAdherenceScore(dailyLog)

    await prisma.dailyLog.update({
      where: { id: dailyLog.id },
      data: { adherenceScore },
    })

    return NextResponse.json({
      success: true,
      scenario,
      targets,
      actuals,
      adherenceScore,
      expectedRange: scenario === 'exact_match' ? '95-100' : '45-55',
    })
  } catch (error) {
    safeLogError('Test adherence error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
