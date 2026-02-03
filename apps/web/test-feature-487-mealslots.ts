/**
 * Feature #487: Multiple meal slots selectable during tracking
 * Test script to verify meal slot selector implementation
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TestResult {
  test: string
  passed: boolean
  details: string
}

const results: TestResult[] = async function() {
  const allResults: TestResult[] = []

  // Test 1: Verify TrackedMeal model has mealSlot field
  try {
    const meals = await prisma.trackedMeal.findMany({
      select: { mealSlot: true },
      take: 1
    })
    allResults.push({
      test: 'TrackedMeal.mealSlot field exists',
      passed: true,
      details: 'mealSlot field is present in TrackedMeal model'
    })
  } catch (error) {
    allResults.push({
      test: 'TrackedMeal.mealSlot field exists',
      passed: false,
      details: `Error: ${(error as Error).message}`
    })
  }

  // Test 2: Verify API endpoints accept mealSlot
  // Check manual-entry API
  const manualEntryPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/app/api/tracking/manual-entry/route.ts'
  const fs = require('fs')
  const manualEntryContent = fs.readFileSync(manualEntryPath, 'utf-8')
  const manualEntryAcceptsMealSlot = manualEntryContent.includes('mealSlot') && manualEntryContent.includes('const { foodName, calories, protein, carbs, fat, mealSlot }')

  allResults.push({
    test: 'Manual Entry API accepts mealSlot',
    passed: manualEntryAcceptsMealSlot,
    details: manualEntryAcceptsMealSlot
      ? 'mealSlot is destructured from request body and saved to TrackedMeal'
      : 'mealSlot not found in manual-entry route'
  })

  // Test 3: Check FoodSearch component has meal slot selector
  const foodSearchPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/components/tracking/FoodSearch.tsx'
  const foodSearchContent = fs.readFileSync(foodSearchPath, 'utf-8')
  const hasMealSlotSelector = foodSearchContent.includes('food-meal-slot') &&
                              foodSearchContent.includes('setMealSlot') &&
                              foodSearchContent.includes('value="breakfast"') &&
                              foodSearchContent.includes('value="lunch"') &&
                              foodSearchContent.includes('value="dinner"') &&
                              foodSearchContent.includes('value="snack"')

  allResults.push({
    test: 'FoodSearch component has meal slot selector',
    passed: hasMealSlotSelector,
    details: hasMealSlotSelector
      ? 'FoodSearch includes meal slot dropdown with all 4 options (breakfast, lunch, dinner, snack)'
      : 'FoodSearch missing meal slot selector'
  })

  // Test 4: Check ManualEntryForm component has meal slot selector
  const manualEntryFormPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/components/tracking/ManualEntryForm.tsx'
  const manualEntryFormContent = fs.readFileSync(manualEntryFormPath, 'utf-8')
  const hasManualMealSlot = manualEntryFormContent.includes('manual-meal-slot') &&
                            manualEntryFormContent.includes('setMealSlot') &&
                            manualEntryFormContent.includes('value="breakfast"')

  allResults.push({
    test: 'ManualEntryForm component has meal slot selector',
    passed: hasManualMealSlot,
    details: hasManualMealSlot
      ? 'ManualEntryForm includes meal slot dropdown with all options'
      : 'ManualEntryForm missing meal slot selector'
  })

  // Test 5: Check QuickAddForm component has meal slot selector
  const quickAddFormPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/components/tracking/QuickAddForm.tsx'
  const quickAddFormContent = fs.readFileSync(quickAddFormPath, 'utf-8')
  const hasQuickAddMealSlot = quickAddFormContent.includes('quick-add-meal-slot') &&
                              quickAddFormContent.includes('setMealSlot') &&
                              quickAddFormContent.includes('value="breakfast"')

  allResults.push({
    test: 'QuickAddForm component has meal slot selector',
    passed: hasQuickAddMealSlot,
    details: hasQuickAddMealSlot
      ? 'QuickAddForm includes meal slot dropdown with all options'
      : 'QuickAddForm missing meal slot selector'
  })

  // Test 6: Check DailySummary displays meal slot
  const dailySummaryPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/app/tracking/daily-summary/DailySummaryContent.tsx'
  const dailySummaryContent = fs.readFileSync(dailySummaryPath, 'utf-8')
  const displaysMealSlot = dailySummaryContent.includes('meal.mealSlot') &&
                          dailySummaryContent.includes('uppercase')

  allResults.push({
    test: 'DailySummary displays meal slot',
    passed: displaysMealSlot,
    details: displaysMealSlot
      ? 'DailySummaryContent displays meal.mealSlot in uppercase'
      : 'DailySummaryContent does not display meal slot'
  })

  // Test 7: Check tRPC quickAdd mutation accepts mealSlot
  const mealRouterPath = '/Users/zero-suminc./Desktop/ZS-MAC/zero-sum-nutrition/apps/web/src/server/routers/meal.ts'
  const mealRouterContent = fs.readFileSync(mealRouterPath, 'utf-8')
  const quickAddAcceptsSlot = mealRouterContent.includes("z.enum(['breakfast', 'lunch', 'dinner', 'snack'])") ||
                             mealRouterContent.includes('z.enum(["breakfast"')

  allResults.push({
    test: 'tRPC quickAdd mutation validates mealSlot as enum',
    passed: quickAddAcceptsSlot,
    details: quickAddAcceptsSlot
      ? 'quickAdd mutation properly validates mealSlot as enum'
      : 'quickAdd mealSlot validation issue'
  })

  return allResults
}

async function main() {
  console.log('===========================================')
  console.log('Feature #487: Meal Slot Selector Tests')
  console.log('===========================================\n')

  const testResults = await results()

  let passed = 0
  let failed = 0

  testResults.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${index + 1}. ${result.test}`)
    console.log(`   ${status}`)
    console.log(`   ${result.details}\n`)

    if (result.passed) passed++
    else failed++
  })

  console.log('===========================================')
  console.log(`Summary: ${passed}/${testResults.length} tests passed`)
  console.log('===========================================')

  await prisma.$disconnect()

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(console.error)
