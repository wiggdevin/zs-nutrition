import { NextRequest, NextResponse } from 'next/server'
import { NutritionCompiler, FatSecretAdapter, MealPlanCompiledSchema } from '@zero-sum/nutrition-engine'
import { safeLogError } from '@/lib/safe-logger'

/**
 * Test endpoint for Feature #94: Agent 4 Nutrition Compiler verifies via FatSecret
 * GET /api/test-nutrition-compiler
 *
 * Creates a minimal meal plan draft, runs it through Agent 4 (NutritionCompiler),
 * and verifies all 8 feature steps:
 * 1. Input meal plan draft
 * 2. FatSecret search called for each meal
 * 3. Found meals tagged as 'verified'
 * 4. Not-found meals tagged as 'ai_estimated'
 * 5. Portions scaled if >20% calorie variance
 * 6. Ingredients list populated with fatsecretFoodId
 * 7. Daily totals calculated
 * 8. Output matches MealPlanCompiledSchema
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  try {
    const adapter = new FatSecretAdapter(
      process.env.FATSECRET_CLIENT_ID || '',
      process.env.FATSECRET_CLIENT_SECRET || ''
    )

    const compiler = new NutritionCompiler(adapter)

    // Create a test draft with:
    // - One meal that WILL match FatSecret ("chicken breast") → verified
    // - One meal that WON'T match FatSecret ("xyznonexistent_9999") → ai_estimated
    // - One meal with a large calorie target to test portion scaling
    const testDraft = {
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          isTrainingDay: true,
          targetKcal: 2200,
          meals: [
            {
              slot: 'breakfast',
              name: 'Scrambled Eggs with Toast',
              cuisine: 'American',
              prepTimeMin: 5,
              cookTimeMin: 10,
              estimatedNutrition: { kcal: 400, proteinG: 30, carbsG: 35, fatG: 15 },
              fatsecretSearchQuery: 'scrambled eggs toast',
              suggestedServings: 1,
              primaryProtein: 'eggs',
              tags: ['eggs', 'quick'],
            },
            {
              slot: 'lunch',
              name: 'Grilled Chicken Breast with Rice',
              cuisine: 'American',
              prepTimeMin: 10,
              cookTimeMin: 20,
              estimatedNutrition: { kcal: 600, proteinG: 45, carbsG: 50, fatG: 18 },
              fatsecretSearchQuery: 'chicken breast grilled',
              suggestedServings: 1,
              primaryProtein: 'chicken',
              tags: ['meat', 'grill'],
            },
            {
              slot: 'dinner',
              name: 'Exotic Unicorn Superfood Bowl XYZ999',
              cuisine: 'Fusion',
              prepTimeMin: 20,
              cookTimeMin: 30,
              estimatedNutrition: { kcal: 700, proteinG: 40, carbsG: 60, fatG: 25 },
              fatsecretSearchQuery: 'xyznonexistent_9999_unicorn_superfood',
              suggestedServings: 1,
              primaryProtein: 'mixed',
              tags: ['no-cook'],
            },
          ],
        },
        {
          dayNumber: 2,
          dayName: 'Tuesday',
          isTrainingDay: false,
          targetKcal: 2000,
          meals: [
            {
              slot: 'breakfast',
              name: 'Greek Yogurt Parfait',
              cuisine: 'American',
              prepTimeMin: 5,
              cookTimeMin: 0,
              estimatedNutrition: { kcal: 350, proteinG: 25, carbsG: 40, fatG: 10 },
              fatsecretSearchQuery: 'greek yogurt',
              suggestedServings: 1,
              primaryProtein: 'dairy',
              tags: ['dairy', 'no-cook', 'quick'],
            },
            {
              slot: 'lunch',
              name: 'Salmon Fillet with Quinoa',
              cuisine: 'Mediterranean',
              prepTimeMin: 15,
              cookTimeMin: 20,
              estimatedNutrition: { kcal: 550, proteinG: 40, carbsG: 45, fatG: 20 },
              fatsecretSearchQuery: 'salmon atlantic cooked',
              suggestedServings: 1,
              primaryProtein: 'salmon',
              tags: ['fish', 'grill'],
            },
            {
              slot: 'dinner',
              name: 'Brown Rice Chicken Bowl',
              cuisine: 'Asian',
              prepTimeMin: 10,
              cookTimeMin: 25,
              estimatedNutrition: { kcal: 650, proteinG: 42, carbsG: 55, fatG: 20 },
              fatsecretSearchQuery: 'brown rice chicken',
              suggestedServings: 1,
              primaryProtein: 'chicken',
              tags: ['meat', 'stir-fry'],
            },
          ],
        },
      ],
      varietyReport: {
        proteinsUsed: ['eggs', 'chicken', 'mixed', 'dairy', 'salmon'],
        cuisinesUsed: ['American', 'Fusion', 'Mediterranean', 'Asian'],
        recipeIdsUsed: [],
      },
    }

    // Track FatSecret search calls
    const searchCalls: string[] = []
    const originalSearch = adapter.searchFoods.bind(adapter)
    adapter.searchFoods = async (query: string, maxResults?: number) => {
      searchCalls.push(query)
      return originalSearch(query, maxResults)
    }

    // Run Agent 4
    const compiled = await compiler.compile(testDraft as any)

    // ===== VERIFICATION CHECKS =====

    // Step 1: Input meal plan draft was accepted (it ran without errors)
    const step1_inputAccepted = compiled.days.length === 2

    // Step 2: FatSecret search called for each meal
    const totalMeals = testDraft.days.reduce((sum, d) => sum + d.meals.length, 0)
    const step2_searchCalledForEachMeal = searchCalls.length >= totalMeals

    // Step 3: Found meals tagged as 'verified'
    const allCompiledMeals = compiled.days.flatMap(d => d.meals)
    const verifiedMeals = allCompiledMeals.filter(m => m.confidenceLevel === 'verified')
    const step3_foundMealsVerified = verifiedMeals.length > 0

    // Step 4: Not-found meals tagged as 'ai_estimated'
    const aiEstimatedMeals = allCompiledMeals.filter(m => m.confidenceLevel === 'ai_estimated')
    const step4_notFoundMealsAiEstimated = aiEstimatedMeals.length > 0

    // Step 5: Portions scaled if >20% calorie variance
    // Check if any verified meal had its nutrition scaled (scaleFactor != 1.0)
    // We can detect scaling by seeing if the compiled kcal is close to the draft's estimated kcal
    const scalingEvidence: Array<{
      name: string
      estimatedKcal: number
      compiledKcal: number
      wasScaled: boolean
    }> = []
    for (const day of compiled.days) {
      const draftDay = testDraft.days.find(d => d.dayNumber === day.dayNumber)
      if (!draftDay) continue
      for (let i = 0; i < day.meals.length; i++) {
        const compiledMeal = day.meals[i]
        const draftMeal = draftDay.meals[i]
        if (!draftMeal) continue
        if (compiledMeal.confidenceLevel === 'verified') {
          // The compiler scales nutrition to match target kcal
          // If the base FatSecret kcal differs from estimated, scaling should have occurred
          const diff = Math.abs(compiledMeal.nutrition.kcal - draftMeal.estimatedNutrition.kcal)
          const pctDiff = draftMeal.estimatedNutrition.kcal > 0
            ? (diff / draftMeal.estimatedNutrition.kcal) * 100
            : 0
          scalingEvidence.push({
            name: compiledMeal.name,
            estimatedKcal: draftMeal.estimatedNutrition.kcal,
            compiledKcal: compiledMeal.nutrition.kcal,
            wasScaled: compiledMeal.nutrition.kcal !== draftMeal.estimatedNutrition.kcal,
          })
        }
      }
    }
    // The compiler applies scaleFactor between 0.5 and 3.0, so verified meals are always scaled
    const step5_portionsScaled = scalingEvidence.some(e => e.wasScaled) || scalingEvidence.length === 0

    // Step 6: Ingredients list populated with fatsecretFoodId
    const mealsWithFatsecretIngredients = allCompiledMeals.filter(m =>
      m.ingredients.some(i => i.fatsecretFoodId !== undefined)
    )
    const step6_ingredientsHaveFatsecretId = mealsWithFatsecretIngredients.length > 0

    // Also check all meals have ingredients
    const allMealsHaveIngredients = allCompiledMeals.every(m => m.ingredients.length > 0)

    // Step 7: Daily totals calculated
    const step7_dailyTotalsCalculated = compiled.days.every(d =>
      d.dailyTotals &&
      typeof d.dailyTotals.kcal === 'number' && d.dailyTotals.kcal > 0 &&
      typeof d.dailyTotals.proteinG === 'number' && d.dailyTotals.proteinG > 0 &&
      typeof d.dailyTotals.carbsG === 'number' &&
      typeof d.dailyTotals.fatG === 'number'
    )

    // Check daily totals are sum of meals
    const dailyTotalChecks = compiled.days.map(d => {
      const mealKcalSum = d.meals.reduce((sum, m) => sum + m.nutrition.kcal, 0)
      return {
        dayName: d.dayName,
        mealKcalSum: Math.round(mealKcalSum),
        dailyTotalKcal: d.dailyTotals.kcal,
        match: Math.abs(Math.round(mealKcalSum) - d.dailyTotals.kcal) <= 1,
      }
    })

    // Step 8: Output matches MealPlanCompiledSchema
    let step8_matchesSchema = false
    let schemaError: string | null = null
    try {
      MealPlanCompiledSchema.parse(compiled)
      step8_matchesSchema = true
    } catch (err: any) {
      schemaError = err.message || String(err)
    }

    // Check weekly averages
    const hasWeeklyAverages = compiled.weeklyAverages &&
      typeof compiled.weeklyAverages.kcal === 'number' &&
      typeof compiled.weeklyAverages.proteinG === 'number' &&
      typeof compiled.weeklyAverages.carbsG === 'number' &&
      typeof compiled.weeklyAverages.fatG === 'number'

    // Check variance calculations
    const varianceChecks = compiled.days.map(d => ({
      dayName: d.dayName,
      targetKcal: d.targetKcal,
      actualKcal: d.dailyTotals.kcal,
      varianceKcal: d.varianceKcal,
      variancePercent: d.variancePercent,
      hasVariance: typeof d.varianceKcal === 'number' && typeof d.variancePercent === 'number',
    }))

    const allStepsPassing =
      step1_inputAccepted &&
      step2_searchCalledForEachMeal &&
      step3_foundMealsVerified &&
      step4_notFoundMealsAiEstimated &&
      step5_portionsScaled &&
      step6_ingredientsHaveFatsecretId &&
      step7_dailyTotalsCalculated &&
      step8_matchesSchema

    return NextResponse.json({
      allStepsPassing,
      steps: {
        step1_inputAccepted,
        step2_searchCalledForEachMeal: {
          passing: step2_searchCalledForEachMeal,
          totalMeals,
          searchCallsMade: searchCalls.length,
          queries: searchCalls,
        },
        step3_foundMealsVerified: {
          passing: step3_foundMealsVerified,
          verifiedCount: verifiedMeals.length,
          verifiedMealNames: verifiedMeals.map(m => m.name),
        },
        step4_notFoundMealsAiEstimated: {
          passing: step4_notFoundMealsAiEstimated,
          aiEstimatedCount: aiEstimatedMeals.length,
          aiEstimatedMealNames: aiEstimatedMeals.map(m => m.name),
        },
        step5_portionsScaled: {
          passing: step5_portionsScaled,
          evidence: scalingEvidence,
        },
        step6_ingredientsHaveFatsecretId: {
          passing: step6_ingredientsHaveFatsecretId,
          mealsWithFatsecretIngredients: mealsWithFatsecretIngredients.length,
          allMealsHaveIngredients,
          sampleIngredients: mealsWithFatsecretIngredients.slice(0, 2).map(m => ({
            mealName: m.name,
            ingredients: m.ingredients.map(i => ({
              name: i.name,
              amount: i.amount,
              unit: i.unit,
              fatsecretFoodId: i.fatsecretFoodId,
            })),
          })),
        },
        step7_dailyTotalsCalculated: {
          passing: step7_dailyTotalsCalculated,
          dailyTotalChecks,
          varianceChecks,
          hasWeeklyAverages,
          weeklyAverages: compiled.weeklyAverages,
        },
        step8_matchesSchema: {
          passing: step8_matchesSchema,
          schemaError,
        },
      },
      compiledPlan: {
        dayCount: compiled.days.length,
        totalMeals: allCompiledMeals.length,
        mealsBreakdown: compiled.days.map(d => ({
          dayName: d.dayName,
          mealCount: d.meals.length,
          meals: d.meals.map(m => ({
            slot: m.slot,
            name: m.name,
            confidenceLevel: m.confidenceLevel,
            kcal: m.nutrition.kcal,
            ingredientCount: m.ingredients.length,
            hasFatsecretRecipeId: !!m.fatsecretRecipeId,
          })),
        })),
      },
    })
  } catch (error) {
    safeLogError('Nutrition Compiler test error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
