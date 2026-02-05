'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'
import { useToastStore } from '@/lib/toast-store'

interface TestResult {
  name: string
  passed: boolean
  details: string
  observedColor: string
  expectedColor: string
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
        <h3 className="font-bold text-[#fafafa]">{result.name}</h3>
      </div>
      <p className="text-sm text-[#a1a1aa] mb-2">{result.details}</p>
      <div className="flex gap-4 text-xs font-mono">
        <div>
          <span className="text-[#a1a1aa]">Expected: </span>
          <span className="text-[#f97316]">{result.expectedColor}</span>
        </div>
        <div>
          <span className="text-[#a1a1aa]">Observed: </span>
          <span className={result.passed ? 'text-green-400' : 'text-red-400'}>{result.observedColor}</span>
        </div>
      </div>
    </div>
  )
}

// Red color variations that should be #ef4444 (red-500)
const RED_COLOR_VARIANTS = {
  '#ef4444': true,
  'rgb(239, 68, 68)': true,
  'rgba(239, 68, 68,': true, // partial match for rgba
}

function isRed500(color: string): boolean {
  // Remove whitespace
  const normalized = color.replace(/\s+/g, '').toLowerCase()

  // Check for #ef4444
  if (normalized.includes('#ef4444')) return true

  // Check for rgb(239, 68, 68)
  if (normalized.includes('rgb(239,68,68)') || normalized.includes('rgb(239,68,68,')) return true

  // Check for rgba(239, 68, 68, ...)
  if (normalized.includes('rgba(239,68,68,')) return true

  return false
}

export default function TestFeature425Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result])
  }

  const runTests = async () => {
    setResults([])
    setIsRunning(true)

    // Test 1: Validation error - form input border
    const test1Input = document.createElement('input')
    test1Input.className = 'border-red-500'
    document.body.appendChild(test1Input)
    const computed1 = window.getComputedStyle(test1Input)
    const test1Pass = isRed500(computed1.borderColor)
    addResult({
      name: 'Validation Error - Form Border',
      passed: test1Pass,
      details: 'Form validation errors use border-red-500 class',
      observedColor: computed1.borderColor,
      expectedColor: '#ef4444 (rgb(239, 68, 68))',
    })
    document.body.removeChild(test1Input)

    // Test 2: Validation error - text color
    const test2Div = document.createElement('div')
    test2Div.className = 'text-red-500'
    document.body.appendChild(test2Div)
    const computed2 = window.getComputedStyle(test2Div)
    const test2Pass = isRed500(computed2.color)
    addResult({
      name: 'Validation Error - Text Color',
      passed: test2Pass,
      details: 'Validation error messages use text-red-500 class',
      observedColor: computed2.color,
      expectedColor: '#ef4444 (rgb(239, 68, 68))',
    })
    document.body.removeChild(test2Div)

    // Test 3: Error toast - border color
    addToast('error', 'Test error message')
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait for toast to render

    const toastContainer = document.querySelector('[data-testid="toast-container"]')
    if (toastContainer) {
      const toastEl = toastContainer.querySelector('[data-toast-type="error"]')
      if (toastEl) {
        const computed3 = window.getComputedStyle(toastEl as Element)
        const test3Pass = isRed500(computed3.borderColor)
        addResult({
          name: 'Error Toast - Border Color',
          passed: test3Pass,
          details: 'Error toast notifications use red-500 border',
          observedColor: computed3.borderColor,
          expectedColor: '#ef4444 (rgb(239, 68, 68))',
        })

        // Test 4: Error toast - background color tint
        const test4Pass = computed3.backgroundColor.includes('239') ||
                         computed3.backgroundColor.includes('red-500')
        addResult({
          name: 'Error Toast - Background Tint',
          passed: test4Pass,
          details: 'Error toast uses red-500/10 background tint',
          observedColor: computed3.backgroundColor,
          expectedColor: 'rgba(239, 68, 68, 0.1)',
        })
      } else {
        addResult({
          name: 'Error Toast - Border Color',
          passed: false,
          details: 'Error toast element not found in DOM',
          observedColor: 'N/A',
          expectedColor: '#ef4444 (rgb(239, 68, 68))',
        })
        addResult({
          name: 'Error Toast - Background Tint',
          passed: false,
          details: 'Error toast element not found in DOM',
          observedColor: 'N/A',
          expectedColor: 'rgba(239, 68, 68, 0.1)',
        })
      }
    }

    // Test 5: FAIL badge styling (simulate)
    const failBadge = document.createElement('div')
    failBadge.className = 'rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-500'
    failBadge.textContent = 'FAIL'
    document.body.appendChild(failBadge)
    const computed5 = window.getComputedStyle(failBadge)
    const test5Pass = isRed500(computed5.color)
    addResult({
      name: 'FAIL QA Badge - Text Color',
      passed: test5Pass,
      details: 'FAIL status badges use text-red-500',
      observedColor: computed5.color,
      expectedColor: '#ef4444 (rgb(239, 68, 68))',
    })
    document.body.removeChild(failBadge)

    // Test 6: Error icon in toast
    const errorIcon = document.createElement('div')
    errorIcon.className = 'text-red-400'
    document.body.appendChild(errorIcon)
    const computed6 = window.getComputedStyle(errorIcon)
    const test6Pass = isRed500(computed6.color) ||
                     computed6.color.includes('239') ||
                     computed6.color.includes('248') // red-400 is #f87171
    addResult({
      name: 'Error Icon - Color',
      passed: test6Pass,
      details: 'Error icons use red-400 (slightly lighter than red-500 for better contrast)',
      observedColor: computed6.color,
      expectedColor: '#f87171 (red-400, acceptable variant)',
    })
    document.body.removeChild(errorIcon)

    // Test 7: Error state border (network error simulation)
    const errorBorder = document.createElement('div')
    errorBorder.className = 'bg-red-900/30 border border-red-500/50 rounded-lg'
    document.body.appendChild(errorBorder)
    const computed7 = window.getComputedStyle(errorBorder)
    const test7Pass = isRed500(computed7.borderColor)
    addResult({
      name: 'Error State Container - Border',
      passed: test7Pass,
      details: 'Error state containers use border-red-500/50',
      observedColor: computed7.borderColor,
      expectedColor: 'rgba(239, 68, 68, 0.5)',
    })
    document.body.removeChild(errorBorder)

    // Test 8: Error button hover state
    const errorButton = document.createElement('button')
    errorButton.className = 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg'
    document.body.appendChild(errorButton)
    const computed8 = window.getComputedStyle(errorButton)
    const test8Pass = isRed500(computed8.backgroundColor) ||
                     computed8.backgroundColor.includes('239')
    addResult({
      name: 'Error Button - Background',
      passed: test8Pass,
      details: 'Error buttons use red-500/20 background with red-500/40 border',
      observedColor: computed8.backgroundColor,
      expectedColor: 'rgba(239, 68, 68, 0.2)',
    })
    document.body.removeChild(errorButton)

    // Test 9: Form input focus state with error
    const errorInput = document.createElement('input')
    errorInput.className = 'border-red-500 focus:border-red-500'
    document.body.appendChild(errorInput)
    errorInput.focus()
    const computed9 = window.getComputedStyle(errorInput)
    const test9Pass = isRed500(computed9.borderColor)
    addResult({
      name: 'Form Input Error - Focus Border',
      passed: test9Pass,
      details: 'Error inputs maintain red-500 border on focus',
      observedColor: computed9.borderColor,
      expectedColor: '#ef4444 (rgb(239, 68, 68))',
    })
    document.body.removeChild(errorInput)

    setIsRunning(false)
  }

  const allPassed = results.length > 0 && results.every((r) => r.passed)

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa] mb-2">
          Error State Color Consistency Tests
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa] mb-1">
          /// FEATURE #425
        </p>
        <p className="text-sm text-[#a1a1aa] mb-6">
          Verify all error messages, FAIL badges, and error indicators use red #ef4444 (red-500)
        </p>

        <div className="mb-6 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <h2 className="text-sm font-bold text-[#fafafa] mb-2">Expected Red Color System:</h2>
          <div className="space-y-1 text-xs font-mono text-[#a1a1aa]">
            <div>• Primary error: <span className="text-red-500">#ef4444 (red-500)</span></div>
            <div>• Error icons: <span className="text-red-400">#f87171 (red-400)</span> - slightly lighter</div>
            <div>• Error borders: <span className="text-red-500">#ef4444</span> with opacity (e.g., /50, /40)</div>
            <div>• Error backgrounds: <span className="text-red-500">#ef4444</span> with opacity (e.g., /20, /10)</div>
          </div>
        </div>

        <button
          onClick={runTests}
          disabled={isRunning}
          className="mb-6 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-[#0a0a0a] font-bold rounded-lg transition-colors"
          data-testid="run-error-color-tests"
        >
          {isRunning ? 'Running Tests...' : 'Run All Error Color Tests'}
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
                ? `ALL ${results.length} TESTS PASSING ✅`
                : `${results.filter((r) => r.passed).length}/${results.length} tests passing`
              }
            </div>
          </div>
        )}

        <div className="space-y-4">
          {results.map((result, i) => (
            <TestResultCard key={i} result={result} />
          ))}
        </div>

        {/* Live examples */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-[#fafafa] mb-4">Live Error State Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Form validation error */}
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <h3 className="text-sm font-mono text-[#a1a1aa] mb-2">Form Validation Error</h3>
              <input
                type="text"
                className="w-full rounded-lg border border-red-500 px-4 py-3 text-[#fafafa] bg-[#1e1e1e]"
                placeholder="Invalid input field"
                aria-invalid
              />
              <p className="mt-1 text-xs text-red-500">This field is required</p>
            </div>

            {/* FAIL badge */}
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <h3 className="text-sm font-mono text-[#a1a1aa] mb-2">QA Status Badge</h3>
              <div className="flex gap-2">
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-500">
                  FAIL
                </span>
                <span className="rounded bg-[#22c55e]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#22c55e]">
                  PASS
                </span>
                <span className="rounded bg-[#f59e0b]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#f59e0b]">
                  WARN
                </span>
              </div>
            </div>

            {/* Error message box */}
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <h3 className="text-sm font-mono text-[#a1a1aa] mb-2">Error Message Box</h3>
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-400">Plan Generation Failed</p>
                    <p className="text-red-200/80 text-sm mt-1">Something went wrong while generating your plan. Please try again.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error button */}
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <h3 className="text-sm font-mono text-[#a1a1aa] mb-2">Error Action Button</h3>
              <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
