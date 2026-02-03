'use client'

import { useState, useRef, useCallback } from 'react'

/**
 * Test page for Feature #259: Network failure during meal logging shows error
 *
 * This page tests the manual entry form's network error handling and retry
 * by intercepting fetch calls to simulate network failures.
 */
export default function TestNetworkErrorPage() {
  const [isNetworkBlocked, setIsNetworkBlocked] = useState(false)
  const [testLog, setTestLog] = useState<string[]>([])
  const originalFetchRef = useRef<typeof fetch | null>(null)

  // Form state (mirroring ManualEntryForm logic)
  const [foodName, setFoodName] = useState('Test Network Error Food')
  const [calories, setCalories] = useState('250')
  const [protein, setProtein] = useState('20')
  const [carbs, setCarbs] = useState('30')
  const [fat, setFat] = useState('8')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastPayloadRef = useRef<object | null>(null)

  const addLog = (msg: string) => {
    setTestLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const toggleNetworkBlock = () => {
    if (!isNetworkBlocked) {
      // Save original fetch and replace with one that rejects for tracking endpoints
      if (!originalFetchRef.current) {
        originalFetchRef.current = window.fetch
      }
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.includes('/api/tracking/')) {
          throw new TypeError('Failed to fetch')
        }
        return originalFetchRef.current!(input, init)
      }
      setIsNetworkBlocked(true)
      addLog('🔴 Network BLOCKED for /api/tracking/* endpoints')
    } else {
      // Restore original fetch
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current
      }
      setIsNetworkBlocked(false)
      addLog('🟢 Network RESTORED')
    }
  }

  const submitEntry = useCallback(async (payload: object) => {
    setIsSubmitting(true)
    setError(null)
    setIsNetworkError(false)
    setSuccessMessage(null)
    lastPayloadRef.current = payload

    try {
      addLog('📤 Submitting meal entry...')
      const res = await fetch('/api/tracking/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to log entry')
        setIsNetworkError(false)
        addLog(`❌ Server error: ${data.error || 'Failed to log entry'}`)
        return
      }

      setSuccessMessage(`Logged "${data.trackedMeal.mealName}" (${data.trackedMeal.kcal} kcal)`)
      lastPayloadRef.current = null
      addLog(`✅ Successfully logged: ${data.trackedMeal.mealName} (${data.trackedMeal.kcal} kcal)`)
    } catch {
      setError('Unable to connect. Please check your internet connection and try again.')
      setIsNetworkError(true)
      addLog('🔴 Network error caught — showing error message + retry button')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitEntry({
      foodName: foodName.trim(),
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    })
  }

  const handleRetry = async () => {
    addLog('🔄 Retry clicked')
    if (lastPayloadRef.current) {
      await submitEntry(lastPayloadRef.current)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">
          Feature #259: Network Error Test
        </h1>
        <p className="text-[#a1a1aa] text-sm">
          This page tests that network failures during meal logging show a friendly error message with a retry button.
        </p>

        {/* Network Toggle Control */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] mb-3">Network Control</h2>
          <button
            onClick={toggleNetworkBlock}
            className={`px-5 py-2.5 font-bold rounded-lg uppercase tracking-wider text-sm transition-colors ${
              isNetworkBlocked
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            data-testid="network-toggle"
          >
            {isNetworkBlocked ? '🟢 Restore Network' : '🔴 Block Network'}
          </button>
          <span className={`ml-3 text-sm font-medium ${isNetworkBlocked ? 'text-red-400' : 'text-green-400'}`} data-testid="network-status">
            Status: {isNetworkBlocked ? 'BLOCKED' : 'CONNECTED'}
          </span>
        </div>

        {/* Manual Entry Form (simplified for testing) */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">Log a Meal (Manual Entry)</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] uppercase mb-1.5">Food Name</label>
              <input
                type="text"
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#111] border border-[#333] rounded-lg text-[#fafafa] focus:outline-none focus:border-[#f97316]"
                data-testid="test-food-name"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#f97316] uppercase mb-1.5">Calories *</label>
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-[#fafafa] focus:outline-none focus:border-[#f97316]"
                  data-testid="test-calories" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-400 uppercase mb-1.5">Protein (g)</label>
                <input type="number" value={protein} onChange={e => setProtein(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-[#fafafa] focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-green-400 uppercase mb-1.5">Carbs (g)</label>
                <input type="number" value={carbs} onChange={e => setCarbs(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-[#fafafa] focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-yellow-400 uppercase mb-1.5">Fat (g)</label>
                <input type="number" value={fat} onChange={e => setFat(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-[#fafafa] focus:outline-none focus:border-yellow-400" />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-[#0a0a0a] font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              data-testid="test-submit"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : 'Log Meal'}
            </button>
          </form>

          {/* Success Message */}
          {successMessage && (
            <div className="mt-3 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm" data-testid="test-success">
              ✅ {successMessage}
            </div>
          )}

          {/* Error Message with Retry */}
          {error && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm" data-testid="test-error">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-300" data-testid="test-error-message">{error}</p>
                  {isNetworkError && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSubmitting}
                      className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="test-retry"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Log */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] mb-3">Test Log</h2>
          <div className="space-y-1 text-xs font-mono text-[#a1a1aa] max-h-60 overflow-y-auto" data-testid="test-log">
            {testLog.length === 0 ? (
              <p className="text-[#666]">No actions yet. Block network, then try to log a meal.</p>
            ) : (
              testLog.map((entry, i) => <p key={i}>{entry}</p>)
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 text-sm text-[#a1a1aa]">
          <h2 className="font-bold text-[#fafafa] uppercase tracking-wider mb-2">Test Steps</h2>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Click <span className="text-red-400 font-medium">&ldquo;Block Network&rdquo;</span> to simulate offline</li>
            <li>Click <span className="text-[#f97316] font-medium">&ldquo;Log Meal&rdquo;</span> to attempt submission</li>
            <li>Verify <span className="text-red-400 font-medium">friendly error message</span> appears</li>
            <li>Verify <span className="text-red-400 font-medium">Retry button</span> is visible</li>
            <li>Click <span className="text-green-400 font-medium">&ldquo;Restore Network&rdquo;</span></li>
            <li>Click <span className="text-red-400 font-medium">&ldquo;Retry&rdquo;</span></li>
            <li>Verify <span className="text-green-400 font-medium">success message</span> appears (meal logged)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
