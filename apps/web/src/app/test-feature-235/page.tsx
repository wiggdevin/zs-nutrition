'use client'

import { useState } from 'react'

export default function TestFeature235Page() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test-feature-235', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Test failed')
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Feature #235: DailyLog Running Totals Test</h1>
        <p className="text-gray-600 mb-6">
          This test verifies that DailyLog totals update correctly as meals are logged and deleted.
        </p>

        <button
          onClick={runTest}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? 'Running Test...' : 'Run Test'}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`p-4 border rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? '✅ All Tests Passed' : '❌ Tests Failed'}
              </h3>
            </div>

            <div className="bg-white p-6 border rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Test Steps</h2>
              <div className="space-y-4">
                {result.steps.map((step: any) => (
                  <div key={step.step} className="border-l-4 pl-4" style={{ borderColor: step.status === 'PASS' ? '#22c55e' : '#ef4444' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Step {step.step}:</span>
                      <span className="text-gray-700">{step.description}</span>
                      <span className={`text-sm font-semibold ${step.status === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>
                        {step.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
                      </span>
                    </div>

                    {step.mealLogged && (
                      <div className="mt-2 text-sm text-gray-600">
                        <div>Logged: {step.mealLogged.name}</div>
                        <div>Calories: {step.mealLogged.kcal} kcal</div>
                        <div>Protein: {step.mealLogged.proteinG}g</div>
                      </div>
                    )}

                    {step.dailyLog && (
                      <div className="mt-2 text-sm">
                        <div className="font-semibold">DailyLog Totals:</div>
                        <div>Calories: <span className="font-mono bg-gray-100 px-1 rounded">{step.dailyLog.actualKcal}</span> kcal</div>
                        <div>Protein: <span className="font-mono bg-gray-100 px-1 rounded">{step.dailyLog.actualProteinG}</span>g</div>
                        <div>Carbs: <span className="font-mono bg-gray-100 px-1 rounded">{step.dailyLog.actualCarbsG}</span>g</div>
                        <div>Fat: <span className="font-mono bg-gray-100 px-1 rounded">{step.dailyLog.actualFatG}</span>g</div>
                      </div>
                    )}

                    {step.verification && (
                      <div className="mt-2 text-sm">
                        <div className="font-semibold">Verification:</div>
                        <div>Expected: {step.verification.expectedKcal} kcal, {step.verification.expectedProteinG}g protein</div>
                        <div className={step.verification.matches ? 'text-green-600' : 'text-red-600'}>
                          {step.verification.matches ? '✅ Matches' : '❌ Does not match'}
                        </div>
                      </div>
                    )}

                    {step.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {step.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg text-sm">
              <h3 className="font-semibold mb-2">Test Details</h3>
              <div>User ID: {result.userId}</div>
              <div>Meal 1 ID: {result.meal1Id}</div>
              <div>Meal 2 ID: {result.meal2Id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
