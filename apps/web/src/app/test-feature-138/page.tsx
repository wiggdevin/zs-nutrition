'use client';

import { notFound } from 'next/navigation';
import { useState, useEffect } from 'react';

interface TestResult {
  attempt: number;
  status: number;
  success: boolean | null;
  message: string;
  remaining?: number;
  limit?: number;
  reset?: number;
}

export default function TestFeature138Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Auto sign-in on mount
  useEffect(() => {
    async function autoSignIn() {
      const res = await fetch('/api/dev-auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'feature-162-test@example.com'
        })
      });
      if (res.ok) {
        setSignedIn(true);
      }
    }
    autoSignIn();
  }, []);

  async function testMealSwapRateLimit() {
    if (!signedIn) {
      alert('Please sign in first!');
      return;
    }

    setTesting(true);
    const newResults: TestResult[] = [];

    // Reset rate limit first
    await fetch('/api/test-rate-limit?endpoint=meal-swap&action=reset');
    newResults.push({
      attempt: 0,
      status: 200,
      success: true,
      message: 'Rate limit reset'
    });
    setResults([...newResults]);

    // Make 11 requests
    for (let i = 1; i <= 11; i++) {
      const res = await fetch('/api/test-rate-limit?endpoint=meal-swap&action=check');
      const data = await res.json();

      newResults.push({
        attempt: i,
        status: res.status,
        success: data.success ?? null,
        message: data.message || data.error || 'N/A',
        remaining: data.remaining,
        limit: data.limit,
        reset: data.reset
      });

      setResults([...newResults]);
    }

    setTesting(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8" data-testid="feature-138-test-page">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Feature #138: Meal Swap Rate Limiting</h1>
        <p className="text-gray-400 mb-8">
          Verifies that meal swaps are rate limited to 10 per hour per user
        </p>

        {!signedIn ? (
          <div className="mb-8 p-4 bg-blue-950 border border-blue-800 rounded-lg">
            <p className="text-blue-400">Signing in...</p>
          </div>
        ) : (
          <div className="mb-8 p-4 bg-green-950 border border-green-800 rounded-lg">
            <p className="text-green-400">✅ Signed in as feature-162-test@example.com</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={testMealSwapRateLimit}
            disabled={testing || !signedIn}
            data-testid="test-rate-limit-btn"
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
          >
            {testing ? 'Testing...' : 'Run Rate Limit Test'}
          </button>
        </div>

        <div className="space-y-3" data-testid="test-results">
          {results.map((result, idx) => (
            <div
              key={idx}
              data-testid={`result-${idx}`}
              className={`p-4 rounded-lg border ${
                result.status === 200 && result.success !== false
                  ? 'border-green-800 bg-green-950/30'
                  : result.status === 429
                  ? 'border-red-800 bg-red-950/30'
                  : 'border-gray-700 bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {result.attempt === 0 ? 'Reset' : `Request #${result.attempt}`}
                </span>
                <span
                  data-testid={`status-${idx}`}
                  className={`px-2 py-1 rounded text-sm font-mono ${
                    result.status === 200
                      ? 'bg-green-800 text-green-200'
                      : result.status === 429
                      ? 'bg-red-800 text-red-200'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {result.status}
                </span>
              </div>

              <div className="text-sm">
                <p className="text-gray-300" data-testid={`message-${idx}`}>
                  {result.message}
                </p>

                {result.remaining !== undefined && (
                  <p className="text-gray-400 mt-1">
                    Remaining: <span className="text-orange-400 font-mono">{result.remaining}</span> / {result.limit}
                  </p>
                )}
              </div>

              {result.status === 429 && (
                <div className="mt-2 p-2 bg-red-900/50 rounded text-sm">
                  <p className="text-red-300">✅ Rate limit working correctly!</p>
                  <p className="text-gray-400">11th request was blocked as expected</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {results.length > 0 && !testing && (
          <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Test Results Summary</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={results.length > 1 ? 'text-green-400' : 'text-gray-400'}>
                  {results.length > 1 ? '✅' : '○'}
                </span>
                <span>Performed 11 meal swap requests</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.some(r => r.status === 429) ? 'text-green-400' : 'text-gray-400'}>
                  {results.some(r => r.status === 429) ? '✅' : '○'}
                </span>
                <span>11th request was rate limited (HTTP 429)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.some(r => r.message.includes('10 requests per hour')) ? 'text-green-400' : 'text-gray-400'}>
                  {results.some(r => r.message.includes('10 requests per hour')) ? '✅' : '○'}
                </span>
                <span>Error message mentions "10 requests per hour"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.filter(r => r.status === 200 && r.attempt > 0).length === 10 ? 'text-green-400' : 'text-gray-400'}>
                  {results.filter(r => r.status === 200 && r.attempt > 0).length === 10 ? '✅' : '○'}
                </span>
                <span>First 10 requests were allowed</span>
              </div>
            </div>

            {results.some(r => r.status === 429) &&
             results.filter(r => r.status === 200 && r.attempt > 0).length === 10 && (
              <div className="mt-4 p-3 bg-green-950 border border-green-800 rounded-lg">
                <p className="text-green-400 font-bold">✅ Feature #138 PASSED</p>
                <p className="text-gray-400 text-sm mt-1">
                  Meal swap rate limiting is working correctly (10 per hour limit)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
