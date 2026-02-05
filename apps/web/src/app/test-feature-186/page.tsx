'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'

interface TestResult {
  step1_seeded: boolean
  step2_caloriesChart: boolean
  step3_proteinChart: boolean
  step4_carbsChart: boolean
  step5_fatChart: boolean
  errors: string[]
}

export default function TestFeature186Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test-feature-186', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Test failed')
      }

      setResult(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const cleanup = async () => {
    setLoading(true)
    try {
      await fetch('/api/test-feature-186', { method: 'DELETE' })
      setResult(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">
          Feature #186 Test: Weekly Trend Chart
        </h1>
        <p className="text-muted-foreground mb-6">
          Tests that the weekly trend chart displays correctly for all metrics (calories, protein, carbs, fat).
        </p>

        <div className="space-y-4 mb-6">
          <button
            onClick={runTest}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-background text-sm font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Test'}
          </button>

          <button
            onClick={cleanup}
            disabled={loading}
            className="ml-4 px-4 py-2 bg-muted hover:bg-accent text-foreground text-sm font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50"
          >
            Cleanup
          </button>

          <a
            href="/tracking/weekly-trend"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 inline-block px-4 py-2 bg-green-500 hover:bg-green-600 text-background text-sm font-bold uppercase tracking-wide rounded-lg transition-colors"
          >
            View Weekly Trend
          </a>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-semibold">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-white font-semibold mb-3">Test Results</h2>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${result.step1_seeded ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Step 1: Seed 7 days of meal data</span>
                  {result.step1_seeded && <span className="text-green-400 text-xs ml-auto">✓ PASS</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${result.step2_caloriesChart ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Step 2: Calories chart data available</span>
                  {result.step2_caloriesChart && <span className="text-green-400 text-xs ml-auto">✓ PASS</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${result.step3_proteinChart ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Step 3: Protein chart data available</span>
                  {result.step3_proteinChart && <span className="text-green-400 text-xs ml-auto">✓ PASS</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${result.step4_carbsChart ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Step 4: Carbs chart data available</span>
                  {result.step4_carbsChart && <span className="text-green-400 text-xs ml-auto">✓ PASS</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${result.step5_fatChart ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-muted-foreground">Step 5: Fat chart data available</span>
                  {result.step5_fatChart && <span className="text-green-400 text-xs ml-auto">✓ PASS</span>}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-red-400 text-sm font-semibold mb-2">Errors:</p>
                  <ul className="text-red-300 text-xs space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-muted-foreground text-xs">
                  All steps passed?{' '}
                  <span
                    className={`font-bold ${
                      result.step1_seeded &&
                      result.step2_caloriesChart &&
                      result.step3_proteinChart &&
                      result.step4_carbsChart &&
                      result.step5_fatChart
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {result.step1_seeded &&
                    result.step2_caloriesChart &&
                    result.step3_proteinChart &&
                    result.step4_carbsChart &&
                    result.step5_fatChart
                      ? '✓ YES'
                      : '✗ NO'}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Manual Verification Steps</h3>
              <ol className="text-muted-foreground text-sm space-y-2 list-decimal list-inside">
                <li>Click "View Weekly Trend" button above</li>
                <li>Verify chart shows for Calories (default)</li>
                <li>Use the "Metric" dropdown to select Protein</li>
                <li>Verify chart updates to show protein data</li>
                <li>Use the dropdown to select Carbs</li>
                <li>Verify chart updates to show carbs data</li>
                <li>Use the dropdown to select Fat</li>
                <li>Verify chart updates to show fat data</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
