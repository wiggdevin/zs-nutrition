'use client'

import { useState } from 'react'

export default function TestFeature243Page() {
  const [status, setStatus] = useState<string>('Idle')
  const [results, setResults] = useState<any[]>([])

  const runTest = async () => {
    try {
      setStatus('Starting test...')
      setResults([])

      const testResults: any[] = []

      // Step 1: Log meals on different dates
      setStatus('Step 1: Logging meals on different dates...')

      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const todayStr = today.toISOString().split('T')[0]
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Log meal for today
      const todayRes = await fetch('/api/trpc/tracking.logMeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            mealName: 'Feature 243 Test Meal - TODAY',
            calories: 500,
            protein: 30,
            carbs: 50,
            fat: 15,
            mealSlot: 'lunch',
            date: todayStr,
          },
        }),
      })
      const todayMeal = await todayRes.json()

      testResults.push({
        step: 'Log meal for today',
        status: todayRes.ok ? 'PASS' : 'FAIL',
        details: todayMeal,
      })

      // Log meal for yesterday
      const yesterdayRes = await fetch('/api/trpc/tracking.logMeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            mealName: 'Feature 243 Test Meal - YESTERDAY',
            calories: 600,
            protein: 40,
            carbs: 60,
            fat: 20,
            mealSlot: 'dinner',
            date: yesterdayStr,
          },
        }),
      })
      const yesterdayMeal = await yesterdayRes.json()

      testResults.push({
        step: 'Log meal for yesterday',
        status: yesterdayRes.ok ? 'PASS' : 'FAIL',
        details: yesterdayMeal,
      })

      // Step 2: Query getDailySummary for today
      setStatus('Step 2: Querying getDailySummary for today...')

      const todaySummaryRes = await fetch(`/api/test-date-isolation?date=${todayStr}`)
      const todaySummary = await todaySummaryRes.json()

      const todayMeals = todaySummary.meals || []
      const todayHasOnlyTodayMeals = todayMeals.length > 0 && todayMeals.every(
        (meal: any) => meal.name.includes('TODAY') || !meal.name.includes('YESTERDAY')
      )

      testResults.push({
        step: 'Query getDailySummary for today',
        status: todaySummaryRes.ok && todayHasOnlyTodayMeals ? 'PASS' : 'FAIL',
        details: {
          date: todayStr,
          fullResponse: todaySummary,
          mealCount: todaySummary.mealCount,
          meals: todayMeals.map((m: any) => ({
            name: m.name,
            kcal: m.loggedDate,
          })),
          verification: todayHasOnlyTodayMeals
            ? 'Only today meals returned'
            : `FAILED: ${todayMeals.length === 0 ? 'No meals found' : 'Contains meals from other dates'}`,
        },
      })

      // Step 3: Verify only today's meals are returned
      setStatus('Step 3: Verifying only today meals returned...')

      const todayMealFound = todayMeals.some(
        (meal: any) => meal.name.includes('TODAY')
      )
      const yesterdayMealNotFound = !todayMeals.some(
        (meal: any) => meal.name.includes('YESTERDAY')
      )

      testResults.push({
        step: 'Verify only date 1 meals returned',
        status: todayMealFound && yesterdayMealNotFound ? 'PASS' : 'FAIL',
        details: {
          todayMealFound,
          yesterdayMealNotFound,
          totalTodayMeals: todayMeals.length,
          verification:
            todayMealFound && yesterdayMealNotFound
              ? 'Correct date isolation verified'
              : `FAILED: Date isolation broken (${todayMeals.length} meals found)`,
        },
      })

      // Step 4: Query for yesterday
      setStatus('Step 4: Querying getDailySummary for yesterday...')

      const yesterdaySummaryRes = await fetch(`/api/test-date-isolation?date=${yesterdayStr}`)
      const yesterdaySummary = await yesterdaySummaryRes.json()

      const yesterdayMeals = yesterdaySummary.meals || []

      testResults.push({
        step: 'Query getDailySummary for yesterday',
        status: yesterdaySummaryRes.ok ? 'PASS' : 'FAIL',
        details: {
          date: yesterdayStr,
          fullResponse: yesterdaySummary,
          mealCount: yesterdaySummary.mealCount,
          meals: yesterdayMeals.map((m: any) => ({
            name: m.name,
            kcal: m.loggedDate,
          })),
        },
      })

      // Step 5: Verify only yesterday's meals are returned
      setStatus('Step 5: Verifying only yesterday meals returned...')

      const yesterdayMealFound = yesterdayMeals.some(
        (meal: any) => meal.name.includes('YESTERDAY')
      )
      const todayMealNotFound = !yesterdayMeals.some(
        (meal: any) => meal.name.includes('TODAY')
      )

      testResults.push({
        step: 'Verify only date 2 meals returned',
        status: yesterdayMealFound && todayMealNotFound ? 'PASS' : 'FAIL',
        details: {
          yesterdayMealFound,
          todayMealNotFound,
          totalYesterdayMeals: yesterdayMeals.length,
          verification:
            yesterdayMealFound && todayMealNotFound
              ? 'Correct date isolation verified'
              : `FAILED: Date isolation broken (${yesterdayMeals.length} meals found)`,
        },
      })

      // Final verification
      const allPassed = testResults.every((r) => r.status === 'PASS')

      testResults.push({
        step: 'FINAL RESULT',
        status: allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌',
        details: {
          totalTests: testResults.length - 1,
          passed: testResults.filter((r) => r.status === 'PASS').length - 1,
          failed: testResults.filter((r) => r.status === 'FAIL').length,
        },
      })

      setResults(testResults)
      setStatus('Test complete!')
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
      setResults([
        {
          step: 'ERROR',
          status: 'FAIL',
          details: { error: error.message, stack: error.stack },
        },
      ])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Feature #243 Test: Tracked Meal Data Organized by Date</h1>
          <p className="text-gray-600 mb-4">
            Verifies that tracking data is properly segmented by date and queries return only meals for the requested
            date.
          </p>

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Status:</p>
            <p className={`text-lg ${status.includes('complete') || status.includes('Idle') ? 'text-green-600' : 'text-blue-600'}`}>
              {status}
            </p>
          </div>

          <button
            onClick={runTest}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Run Test
          </button>
        </div>

        {results.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Test Results</h2>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`border-l-4 p-4 rounded ${
                    result.status === 'PASS' || result.status.includes('PASSED')
                      ? 'border-green-500 bg-green-50'
                      : result.status === 'FAIL' || result.status.includes('FAILED')
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-500 bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-lg mb-2">
                    Step {index + 1}: {result.step}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Status: </span>
                    <span
                      className={
                        result.status === 'PASS' || result.status.includes('PASSED')
                          ? 'text-green-700'
                          : result.status === 'FAIL' || result.status.includes('FAILED')
                            ? 'text-red-700'
                            : 'text-gray-700'
                      }
                    >
                      {result.status}
                    </span>
                  </div>
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
