'use client';

import { notFound } from 'next/navigation';
import { useState } from 'react';

interface TestResult {
  endpoint: string;
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export default function TestRateLimitPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  async function makeRequest(endpoint: string, action: string): Promise<TestResult> {
    const res = await fetch(`/api/test-rate-limit?endpoint=${endpoint}&action=${action}`);
    const body = await res.json();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-ratelimit') || key.toLowerCase() === 'retry-after') {
        headers[key] = value;
      }
    });
    return { endpoint, status: res.status, headers, body };
  }

  async function testPlanGeneration() {
    setTesting(true);
    setResults([]);
    const newResults: TestResult[] = [];

    // Reset first
    await makeRequest('plan-generation', 'reset');

    // Make 4 requests (limit is 3, so 4th should fail)
    for (let i = 1; i <= 4; i++) {
      const result = await makeRequest('plan-generation', 'check');
      newResults.push({ ...result, endpoint: `plan-generation #${i}` });
      setResults([...newResults]);
    }

    setTesting(false);
  }

  async function testMealSwap() {
    setTesting(true);
    setResults([]);
    const newResults: TestResult[] = [];

    // Reset first
    await makeRequest('meal-swap', 'reset');

    // Make 11 requests (limit is 10, so 11th should fail)
    for (let i = 1; i <= 11; i++) {
      const result = await makeRequest('meal-swap', 'check');
      newResults.push({ ...result, endpoint: `meal-swap #${i}` });
      setResults([...newResults]);
    }

    setTesting(false);
  }

  async function testPerUser() {
    setTesting(true);
    setResults([]);
    const newResults: TestResult[] = [];

    // Reset first
    await makeRequest('plan-generation', 'reset');

    // Check status without consuming
    const statusResult = await makeRequest('plan-generation', 'status');
    newResults.push({ ...statusResult, endpoint: 'status (no consume)' });

    // Consume 2 tokens
    for (let i = 1; i <= 2; i++) {
      const result = await makeRequest('plan-generation', 'check');
      newResults.push({ ...result, endpoint: `check #${i}` });
    }

    // Check status again - should show 1 remaining
    const statusResult2 = await makeRequest('plan-generation', 'status');
    newResults.push({ ...statusResult2, endpoint: 'status after 2 checks' });

    setResults([...newResults]);
    setTesting(false);
  }

  async function resetAll() {
    await makeRequest('plan-generation', 'reset');
    await makeRequest('meal-swap', 'reset');
    setResults([]);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8" data-testid="rate-limit-test-page">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Rate Limit Test Page</h1>
        <p className="text-gray-400 mb-8">
          Tests Upstash-style rate limiting on AI endpoints (plan generation &amp; meal swap)
        </p>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={testPlanGeneration}
            disabled={testing}
            data-testid="test-plan-generation"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-medium transition"
          >
            {testing ? 'Testing...' : 'Test Plan Generation (3/hour)'}
          </button>
          <button
            onClick={testMealSwap}
            disabled={testing}
            data-testid="test-meal-swap"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-lg font-medium transition"
          >
            {testing ? 'Testing...' : 'Test Meal Swap (10/hour)'}
          </button>
          <button
            onClick={testPerUser}
            disabled={testing}
            data-testid="test-per-user"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg font-medium transition"
          >
            {testing ? 'Testing...' : 'Test Per-User Tracking'}
          </button>
          <button
            onClick={resetAll}
            disabled={testing}
            data-testid="reset-all"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg font-medium transition"
          >
            Reset All Limits
          </button>
        </div>

        <div className="space-y-4" data-testid="test-results">
          {results.map((result, idx) => (
            <div
              key={idx}
              data-testid={`result-${idx}`}
              className={`p-4 rounded-lg border ${
                result.status === 200
                  ? 'border-green-800 bg-green-950/50'
                  : result.status === 429
                  ? 'border-red-800 bg-red-950/50'
                  : 'border-gray-700 bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{result.endpoint}</span>
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

              {Object.keys(result.headers).length > 0 && (
                <div className="mb-2" data-testid={`headers-${idx}`}>
                  <span className="text-gray-400 text-sm">Rate Limit Headers:</span>
                  <div className="font-mono text-sm text-gray-300 mt-1">
                    {Object.entries(result.headers).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-blue-400">{key}</span>: {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-400">
                {(() => {
                  const body = result.body as Record<string, unknown>;
                  return body?.message ? (
                    <span data-testid={`message-${idx}`}>{String(body.message)}</span>
                  ) : body?.error ? (
                    <span className="text-red-400" data-testid={`error-${idx}`}>
                      {String(body.error)}: {String(body.message || '')}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !testing && (
          <div className="text-center py-16 text-gray-500">
            Click a test button above to start testing rate limits.
          </div>
        )}
      </div>
    </div>
  );
}
