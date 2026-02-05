'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

interface TestResult {
  name: string
  passed: boolean
  errorMessage: string | null
  zodErrors: Record<string, string[]> | null
  details: string
}

function TestResultCard({ result }: { result: TestResult }) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        result.passed
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}
      data-testid={`test-result-${result.name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
          {result.passed ? '✅' : '❌'}
        </span>
        <h3 className="font-bold text-foreground">{result.name}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{result.details}</p>
      {result.errorMessage && (
        <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm">
          <p className="text-xs font-mono text-muted-foreground mb-1">Error message:</p>
          <p className="text-red-400" data-testid="validation-error-message">{result.errorMessage}</p>
        </div>
      )}
      {result.zodErrors && Object.keys(result.zodErrors).length > 0 && (
        <div className="mt-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-sm">
          <p className="text-xs font-mono text-muted-foreground mb-1">Field-specific errors:</p>
          {Object.entries(result.zodErrors).map(([field, messages]) => (
            <p key={field} className="text-orange-400" data-testid={`field-error-${field}`}>
              <span className="font-bold">{field}</span>: {messages.join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TestValidationPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [apiResults, setApiResults] = useState<Record<string, unknown> | null>(null)

  // tRPC mutations for testing
  const completeOnboarding = trpc.user.completeOnboarding.useMutation()
  const quickAdd = trpc.meal.quickAdd.useMutation()

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result])
  }

  const extractZodErrors = (err: unknown): Record<string, string[]> | null => {
    try {
      // tRPC with our custom errorFormatter includes zodError in data
      const trpcErr = err as { data?: { zodError?: { fieldErrors?: Record<string, string[]> } } }
      if (trpcErr?.data?.zodError?.fieldErrors) {
        return trpcErr.data.zodError.fieldErrors
      }
    } catch {
      // fallback
    }
    return null
  }

  const runTests = async () => {
    setResults([])
    setIsRunning(true)

    // Test 1: Onboarding with age=5 (below min 18)
    try {
      await completeOnboarding.mutateAsync({
        name: 'Test User',
        sex: 'male',
        age: 5, // INVALID: below min 18
        heightCm: 175,
        weightKg: 70,
        goalType: 'maintain',
        goalRate: 1,
        activityLevel: 'moderately_active',
        trainingDays: ['monday'],
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePreferences: [],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 30,
        macroStyle: 'balanced',
      })
      addResult({
        name: 'Onboarding age=5',
        passed: false,
        errorMessage: null,
        zodErrors: null,
        details: 'FAILED: Should have thrown validation error but succeeded',
      })
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || ''
      const zodErrors = extractZodErrors(err)
      const hasAgeField = msg.includes('age') || (zodErrors && 'age' in zodErrors)
      addResult({
        name: 'Onboarding age=5',
        passed: hasAgeField === true,
        errorMessage: msg,
        zodErrors,
        details: hasAgeField
          ? 'Zod validation error returned with age field reference'
          : 'Error returned but missing age field reference',
      })
    }

    // Test 2: Verify user-friendly error message for age
    // (Already tested above, we just check the message is readable)

    // Test 3: Tracking with negative calories
    try {
      await quickAdd.mutateAsync({
        calories: -100, // INVALID: negative, below min 1
      })
      addResult({
        name: 'Tracking negative calories',
        passed: false,
        errorMessage: null,
        zodErrors: null,
        details: 'FAILED: Should have thrown validation error but succeeded',
      })
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || ''
      const zodErrors = extractZodErrors(err)
      const hasCaloriesField = msg.includes('calories') || (zodErrors && 'calories' in zodErrors)
      addResult({
        name: 'Tracking negative calories',
        passed: hasCaloriesField === true,
        errorMessage: msg,
        zodErrors,
        details: hasCaloriesField
          ? 'Zod validation error returned with calories field reference'
          : 'Error returned but missing calories field reference',
      })
    }

    // Test 4: Verify field-specific messages
    try {
      await quickAdd.mutateAsync({
        calories: 0, // INVALID: below min 1
      })
      addResult({
        name: 'Tracking calories=0',
        passed: false,
        errorMessage: null,
        zodErrors: null,
        details: 'FAILED: Should have thrown validation error but succeeded',
      })
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || ''
      const zodErrors = extractZodErrors(err)
      const referencesField = msg.includes('calories') || (zodErrors && 'calories' in zodErrors)
      addResult({
        name: 'Tracking calories=0',
        passed: referencesField === true,
        errorMessage: msg,
        zodErrors,
        details: referencesField
          ? 'Error references the specific calories field'
          : 'Error does not reference the specific field',
      })
    }

    // Test 5: Fetch API-level validation test
    try {
      const res = await fetch('/api/dev-test/validation')
      const data = await res.json()
      setApiResults(data)
      addResult({
        name: 'API schema validation tests',
        passed: data.summary.status === 'ALL_PASSING',
        errorMessage: null,
        zodErrors: null,
        details: `${data.summary.invalid} invalid inputs correctly caught, ${data.summary.valid} valid inputs passed. All errors reference fields: ${data.summary.allErrorsReferenceFields}`,
      })
    } catch (err: unknown) {
      addResult({
        name: 'API schema validation tests',
        passed: false,
        errorMessage: (err as { message?: string })?.message || 'Failed to fetch',
        zodErrors: null,
        details: 'Failed to call validation test API',
      })
    }

    setIsRunning(false)
  }

  const allPassed = results.length > 0 && results.every((r) => r.passed)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          tRPC Zod Validation Error Tests
        </h1>
        <p className="text-muted-foreground mb-6">
          Feature #261: Invalid tRPC input returns validation error
        </p>

        <button
          onClick={runTests}
          disabled={isRunning}
          className="mb-6 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-background font-bold rounded-lg transition-colors"
          data-testid="run-validation-tests"
        >
          {isRunning ? 'Running Tests...' : 'Run All Validation Tests'}
        </button>

        {results.length > 0 && (
          <div className="mb-6">
            <div
              className={`px-4 py-3 rounded-lg font-bold text-lg ${
                allPassed
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
              data-testid="test-summary"
            >
              {allPassed
                ? `ALL ${results.length} TESTS PASSING`
                : `${results.filter((r) => r.passed).length}/${results.length} tests passing`}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {results.map((result, i) => (
            <TestResultCard key={i} result={result} />
          ))}
        </div>

        {apiResults && (
          <div className="mt-6 p-4 bg-card border border-border rounded-lg">
            <h3 className="text-sm font-mono text-muted-foreground mb-2">API Test Details:</h3>
            <pre className="text-xs text-muted-foreground overflow-auto max-h-60">
              {JSON.stringify(apiResults, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
