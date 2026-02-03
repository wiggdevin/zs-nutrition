/**
 * Feature #416 Test Page
 * Automated test page for adherence score verification
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface TestResult {
  scenario: string
  targets: any
  actuals: any
  adherenceScore: number
  expectedRange: string
  timestamp: string
}

export default function Test416Page() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTest = async (scenario: 'exact_match' | 'half_match' | 'clear') => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/test-adherence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (scenario !== 'clear') {
        setResults(prev => [...prev, {
          ...data,
          timestamp: new Date().toISOString()
        } as TestResult])
      } else {
        setResults([])
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const runAllTests = async () => {
    setResults([])
    setError(null)

    try {
      // Clear first
      await runTest('clear')
      await new Promise(resolve => setTimeout(resolve, 500))

      // Test exact match
      console.log('Running exact_match test...')
      const exactResult = await runTest('exact_match')
      console.log('Exact match result:', exactResult)

      await new Promise(resolve => setTimeout(resolve, 500))

      // Clear and test half match
      await runTest('clear')
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('Running half_match test...')
      const halfResult = await runTest('half_match')
      console.log('Half match result:', halfResult)

    } catch (err) {
      console.error('Test error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature #416: Adherence Score Test</h1>
        <p className="text-[#a1a1aa] mb-8">
          Verify that adherence score displays 100 when actuals match targets exactly
        </p>

        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6 border border-[#2a2a2a]">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>

          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={runAllTests}
              disabled={loading}
              className="bg-[#f97316] hover:bg-[#f97316]/90"
            >
              {loading ? 'Running Tests...' : 'Run All Tests'}
            </Button>

            <Button
              onClick={() => runTest('exact_match')}
              disabled={loading}
              variant="outline"
              className="border-[#2a2a2a]"
            >
              Test Exact Match
            </Button>

            <Button
              onClick={() => runTest('half_match')}
              disabled={loading}
              variant="outline"
              className="border-[#2a2a2a]"
            >
              Test Half Match
            </Button>

            <Button
              onClick={() => runTest('clear')}
              disabled={loading}
              variant="outline"
              className="border-[#2a2a2a]"
            >
              Clear Data
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200">
              Error: {error}
            </div>
          )}
        </div>

        {/* Results Display */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Test Results</h2>

            {results.map((result, idx) => {
              const isPassing = result.scenario === 'exact_match'
                ? result.adherenceScore === 100
                : result.adherenceScore < 100 && result.adherenceScore > 40

              return (
                <div
                  key={idx}
                  className={`bg-[#1a1a1a] rounded-lg p-6 border ${
                    isPassing ? 'border-green-500/50' : 'border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Test: {result.scenario.replace('_', ' ')}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      isPassing
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {isPassing ? '✅ PASS' : '❌ FAIL'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-[#a1a1aa] mb-2">Targets</h4>
                      <div className="space-y-1 font-mono">
                        <div>🔥 Calories: {result.targets.kcal} kcal</div>
                        <div>💪 Protein: {result.targets.proteinG}g</div>
                        <div>🍞 Carbs: {result.targets.carbsG}g</div>
                        <div>🥑 Fat: {result.targets.fatG}g</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-[#a1a1aa] mb-2">Actuals</h4>
                      <div className="space-y-1 font-mono">
                        <div>🔥 Calories: {result.actuals.kcal} kcal</div>
                        <div>💪 Protein: {result.actuals.proteinG}g</div>
                        <div>🍞 Carbs: {result.actuals.carbsG}g</div>
                        <div>🥑 Fat: {result.actuals.fatG}g</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#a1a1aa]">Adherence Score:</span>
                      <span className="text-3xl font-bold text-[#f97316]">
                        {result.adherenceScore}
                      </span>
                    </div>
                    <div className="text-sm text-[#a1a1aa] mt-1">
                      Expected: {result.expectedRange}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {results.length >= 2 && (
          <div className="mt-6 bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>

            <div className="space-y-2">
              {results.map((result, idx) => {
                const isPassing = result.scenario === 'exact_match'
                  ? result.adherenceScore === 100
                  : result.adherenceScore < 100 && result.adherenceScore > 40

                return (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span>{result.scenario.replace('_', ' ')}</span>
                    <span className={isPassing ? 'text-green-400' : 'text-red-400'}>
                      {isPassing ? '✅ PASS' : '❌ FAIL'}
                    </span>
                  </div>
                )
              })}

              <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-between font-semibold">
                <span>Overall</span>
                <span className={results.every(r =>
                  r.scenario === 'exact_match' ? r.adherenceScore === 100 :
                  r.adherenceScore < 100 && r.adherenceScore > 40
                ) ? 'text-green-400' : 'text-red-400'}>
                  {results.every(r =>
                    r.scenario === 'exact_match' ? r.adherenceScore === 100 :
                    r.adherenceScore < 100 && r.adherenceScore > 40
                  ) ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Verification Checklist */}
        <div className="mt-6 bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <h2 className="text-xl font-semibold mb-4">Verification Checklist</h2>

          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className={results.some(r => r.scenario === 'exact_match' && r.adherenceScore === 100)
                ? '✅' : '○'} className="mt-1"/>
              <span>Log meals that exactly match daily targets → adherence score displays 100</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={results.some(r => r.scenario === 'exact_match' && r.adherenceScore === 100)
                ? '✅' : '○'} className="mt-1"/>
              <span>Verify score calculation is based on all macros (kcal, P, C, F)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={results.some(r => r.scenario === 'half_match' && r.adherenceScore < 100)
                ? '✅' : '○'} className="mt-1"/>
              <span>Partially log meals and verify score &lt; 100</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
