import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { savePlanToDatabase } from '@/lib/save-plan'

/**
 * TEST ENDPOINT — Development only
 * Simulates a successful plan generation and verifies MealPlan persistence.
 *
 * POST /api/test-plan-save
 *
 * Verifies Feature #155: "Plan generation saves MealPlan to database"
 * 1. Creates a PlanGenerationJob (simulating queue job)
 * 2. Calls savePlanToDatabase with realistic plan data
 * 3. Verifies all MealPlan fields are correctly populated
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    // Ensure a test user exists
    const clerkUserId = 'test_user_feature_155'
    let testUser = await prisma.user.findUnique({
      where: { clerkUserId },
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          clerkUserId,
          email: 'test-feature-155@test.dev',
        },
      })
    }

    // Ensure a profile exists
    let profile = await prisma.userProfile.findFirst({
      where: { userId: testUser.id, isActive: true },
    })

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: testUser.id,
          name: 'Feature 155 Test User',
          sex: 'male',
          age: 30,
          heightCm: 177.8,
          weightKg: 81.6,
          goalType: 'cut',
          goalRate: 1,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          mealsPerDay: 3,
          snacksPerDay: 1,
          cookingSkill: 5,
          prepTimeMax: 30,
          macroStyle: 'balanced',
          bmrKcal: 1800,
          tdeeKcal: 2790,
          goalKcal: 2290,
          proteinTargetG: 172,
          carbsTargetG: 229,
          fatTargetG: 76,
        },
      })
    }

    // Step 1: Create a PlanGenerationJob (simulating what the queue does)
    const job = await prisma.planGenerationJob.create({
      data: {
        userId: testUser.id,
        status: 'running',
        currentAgent: 6,
        intakeData: JSON.stringify({
          name: 'Feature 155 Test User',
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
        }),
        startedAt: new Date(),
      },
    })

    // Step 2: Create realistic plan data (what the pipeline would produce)
    const planData = {
      days: Array.from({ length: 7 }, (_, i) => ({
        dayNumber: i + 1,
        dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
        isTrainingDay: [1, 3, 5].includes(i + 1),
        targetKcal: 2290,
        meals: [
          {
            slot: 'breakfast',
            name: `Day ${i + 1} Breakfast - Oatmeal Bowl`,
            cuisine: 'american',
            prepTimeMin: 5,
            cookTimeMin: 5,
            nutrition: { kcal: 420, proteinG: 35, carbsG: 48, fatG: 12, fiberG: 6 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Oats', amount: '80g' },
              { name: 'Protein powder', amount: '1 scoop' },
              { name: 'Banana', amount: '1 medium' },
            ],
            instructions: ['Cook oats', 'Mix in protein powder', 'Top with banana'],
          },
          {
            slot: 'lunch',
            name: `Day ${i + 1} Lunch - Chicken Rice Bowl`,
            cuisine: 'american',
            prepTimeMin: 10,
            cookTimeMin: 15,
            nutrition: { kcal: 600, proteinG: 50, carbsG: 55, fatG: 18, fiberG: 5 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Chicken breast', amount: '200g' },
              { name: 'Brown rice', amount: '100g dry' },
              { name: 'Broccoli', amount: '150g' },
            ],
            instructions: ['Cook rice', 'Grill chicken', 'Steam broccoli', 'Assemble bowl'],
          },
          {
            slot: 'dinner',
            name: `Day ${i + 1} Dinner - Salmon & Sweet Potato`,
            cuisine: 'american',
            prepTimeMin: 10,
            cookTimeMin: 25,
            nutrition: { kcal: 650, proteinG: 45, carbsG: 42, fatG: 30, fiberG: 7 },
            confidenceLevel: 'verified',
            ingredients: [
              { name: 'Salmon fillet', amount: '200g' },
              { name: 'Sweet potato', amount: '200g' },
              { name: 'Asparagus', amount: '150g' },
            ],
            instructions: ['Preheat oven 400F', 'Season salmon', 'Roast all together'],
          },
          {
            slot: 'snack',
            name: `Day ${i + 1} Snack - Protein Shake`,
            cuisine: 'american',
            prepTimeMin: 2,
            cookTimeMin: 0,
            nutrition: { kcal: 280, proteinG: 30, carbsG: 15, fatG: 10, fiberG: 2 },
            confidenceLevel: 'ai_estimated',
            ingredients: [
              { name: 'Whey protein', amount: '1.5 scoops' },
              { name: 'Almond milk', amount: '300ml' },
              { name: 'Peanut butter', amount: '15g' },
            ],
            instructions: ['Blend all ingredients'],
          },
        ],
      })),
      groceryList: [
        { category: 'Grains', items: [{ name: 'Oats', amount: '560g' }, { name: 'Brown rice', amount: '700g' }] },
        { category: 'Protein', items: [{ name: 'Chicken breast', amount: '1400g' }, { name: 'Salmon fillet', amount: '1400g' }] },
        { category: 'Produce', items: [{ name: 'Broccoli', amount: '1050g' }, { name: 'Sweet potato', amount: '1400g' }] },
      ],
      qa: { status: 'PASS', score: 88, iterations: 2 },
      weeklyTotals: { avgKcal: 1950, avgProteinG: 160, avgCarbsG: 160, avgFatG: 70 },
    }

    const metabolicProfile = {
      bmrKcal: 1800,
      tdeeKcal: 2790,
      goalKcal: 2290,
      proteinTargetG: 172,
      carbsTargetG: 229,
      fatTargetG: 76,
      trainingBonusKcal: 200,
    }

    // Step 3: Call savePlanToDatabase (the function under test)
    const result = await savePlanToDatabase({
      jobId: job.id,
      planData,
      metabolicProfile,
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        jobId: job.id,
      }, { status: 500 })
    }

    // Step 4: Verify everything was saved correctly
    const savedPlan = await prisma.mealPlan.findUnique({
      where: { id: result.planId! },
    })

    const updatedJob = await prisma.planGenerationJob.findUnique({
      where: { id: job.id },
    })

    if (!savedPlan) {
      return NextResponse.json({
        success: false,
        error: 'MealPlan record was not created',
        jobId: job.id,
      }, { status: 500 })
    }

    // Parse JSON fields for verification
    const savedValidatedPlan = JSON.parse(savedPlan.validatedPlan)
    const savedMetabolicProfile = JSON.parse(savedPlan.metabolicProfile)
    const jobResult = updatedJob?.result ? JSON.parse(updatedJob.result) : null

    // Build verification report
    const verification = {
      mealPlanCreated: !!savedPlan,
      planId: savedPlan.id,
      jobId: job.id,

      // Verify validatedPlan JSON contains full plan data
      validatedPlanHasDays: Array.isArray(savedValidatedPlan.days),
      validatedPlanDayCount: savedValidatedPlan.days?.length,
      validatedPlanHasGroceryList: !!savedValidatedPlan.groceryList,
      validatedPlanHasQA: !!savedValidatedPlan.qa,
      validatedPlanHasWeeklyTotals: !!savedValidatedPlan.weeklyTotals,

      // Verify metabolicProfile JSON saved
      metabolicProfileSaved: !!savedMetabolicProfile,
      metabolicProfileHasBmr: !!savedMetabolicProfile.bmrKcal,
      metabolicProfileHasTdee: !!savedMetabolicProfile.tdeeKcal,
      metabolicProfileHasGoalKcal: !!savedMetabolicProfile.goalKcal,
      metabolicProfileHasMacros: !!(
        savedMetabolicProfile.proteinTargetG &&
        savedMetabolicProfile.carbsTargetG &&
        savedMetabolicProfile.fatTargetG
      ),

      // Verify denormalized fields populated
      dailyKcalTarget: savedPlan.dailyKcalTarget,
      dailyKcalTargetPopulated: savedPlan.dailyKcalTarget !== null && savedPlan.dailyKcalTarget > 0,
      dailyProteinG: savedPlan.dailyProteinG,
      dailyProteinGPopulated: savedPlan.dailyProteinG !== null && savedPlan.dailyProteinG > 0,
      dailyCarbsG: savedPlan.dailyCarbsG,
      dailyCarbsGPopulated: savedPlan.dailyCarbsG !== null && savedPlan.dailyCarbsG > 0,
      dailyFatG: savedPlan.dailyFatG,
      dailyFatGPopulated: savedPlan.dailyFatG !== null && savedPlan.dailyFatG > 0,

      // Verify qaScore and qaStatus saved
      qaScore: savedPlan.qaScore,
      qaScoreSaved: savedPlan.qaScore !== null && savedPlan.qaScore > 0,
      qaStatus: savedPlan.qaStatus,
      qaStatusSaved: savedPlan.qaStatus === 'PASS',

      // Verify status is 'active'
      status: savedPlan.status,
      statusIsActive: savedPlan.status === 'active',

      // Verify isActive is true
      isActive: savedPlan.isActive,
      isActiveIsTrue: savedPlan.isActive === true,

      // Verify job updated correctly
      jobStatus: updatedJob?.status,
      jobCompleted: updatedJob?.status === 'completed',
      jobHasResult: !!jobResult,
      jobResultHasPlanId: jobResult?.planId === savedPlan.id,
      jobCompletedAt: updatedJob?.completedAt,
    }

    // Check all verification steps pass
    const allPassed =
      verification.mealPlanCreated &&
      verification.validatedPlanHasDays &&
      verification.validatedPlanDayCount === 7 &&
      verification.validatedPlanHasGroceryList &&
      verification.validatedPlanHasQA &&
      verification.validatedPlanHasWeeklyTotals &&
      verification.metabolicProfileSaved &&
      verification.metabolicProfileHasBmr &&
      verification.metabolicProfileHasTdee &&
      verification.metabolicProfileHasGoalKcal &&
      verification.metabolicProfileHasMacros &&
      verification.dailyKcalTargetPopulated &&
      verification.dailyProteinGPopulated &&
      verification.dailyCarbsGPopulated &&
      verification.dailyFatGPopulated &&
      verification.qaScoreSaved &&
      verification.qaStatusSaved &&
      verification.statusIsActive &&
      verification.isActiveIsTrue &&
      verification.jobCompleted &&
      verification.jobResultHasPlanId

    return NextResponse.json({
      success: true,
      allVerificationsPassed: allPassed,
      verification,
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
 * GET /api/test-plan-save
 * Returns existing MealPlan records for verification.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const plans = await prisma.mealPlan.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userId: true,
        profileId: true,
        dailyKcalTarget: true,
        dailyProteinG: true,
        dailyCarbsG: true,
        dailyFatG: true,
        qaScore: true,
        qaStatus: true,
        status: true,
        isActive: true,
        planDays: true,
        generatedAt: true,
      },
    })

    return NextResponse.json({
      totalPlans: plans.length,
      plans,
    })
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
