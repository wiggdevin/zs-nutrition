"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";

interface TestResult {
  step: string;
  description: string;
  passed: boolean;
  details: string;
}

interface TestResponse {
  testName: string;
  testId: string;
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  userA: { id: string; email: string };
  userB: { id: string; email: string };
  results: TestResult[];
  error?: string;
}

export default function TestTrackingIsolationPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [testResponse, setTestResponse] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setError(null);
    setTestResponse(null);

    try {
      const res = await fetch("/api/dev-test/tracking-isolation");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Test failed");
        if (data.testResults) {
          setTestResponse(data as TestResponse);
        }
      } else {
        setTestResponse(data);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-2xl font-bold mb-2"
          data-testid="tracking-isolation-title"
        >
          Tracking Data Isolation Test
        </h1>
        <p className="text-neutral-400 mb-6">
          Feature #255: Verify that tracking data is properly isolated between
          users. User A&apos;s meals cannot be seen or deleted by User B.
        </p>

        <button
          onClick={runTest}
          disabled={loading}
          data-testid="run-isolation-test"
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 disabled:text-neutral-400 text-background font-semibold rounded-lg transition-colors mb-6"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running Tests...
            </span>
          ) : (
            "Run Isolation Test"
          )}
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">Error: {error}</p>
          </div>
        )}

        {testResponse && (
          <div data-testid="test-results">
            {/* Overall Status */}
            <div
              className={`rounded-lg p-4 mb-6 ${
                testResponse.allPassed
                  ? "bg-green-900/30 border border-green-700"
                  : "bg-red-900/30 border border-red-700"
              }`}
              data-testid="test-overall-status"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {testResponse.allPassed ? "✅" : "❌"}
                </span>
                <div>
                  <h2 className="text-lg font-bold">
                    {testResponse.allPassed
                      ? "ALL TESTS PASSED"
                      : "SOME TESTS FAILED"}
                  </h2>
                  <p className="text-neutral-300">
                    {testResponse.passedCount}/{testResponse.totalCount} tests
                    passed | Test ID: {testResponse.testId}
                  </p>
                </div>
              </div>
            </div>

            {/* User Info */}
            {testResponse.userA && testResponse.userB && (
              <div className="bg-neutral-900 rounded-lg p-4 mb-6 border border-neutral-800">
                <h3 className="font-semibold text-neutral-300 mb-2">
                  Test Users (temporary, auto-cleaned)
                </h3>
                <p className="text-sm text-neutral-400">
                  User A: {testResponse.userA.email} ({testResponse.userA.id})
                </p>
                <p className="text-sm text-neutral-400">
                  User B: {testResponse.userB.email} ({testResponse.userB.id})
                </p>
              </div>
            )}

            {/* Individual Results */}
            <div className="space-y-3">
              {testResponse.results?.map((result, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-4 border ${
                    result.passed
                      ? "bg-neutral-900 border-green-800"
                      : "bg-red-950/30 border-red-800"
                  }`}
                  data-testid={`test-step-${result.step}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {result.passed ? "✅" : "❌"}
                    </span>
                    <div>
                      <h4 className="font-semibold">
                        Step {result.step}: {result.description}
                      </h4>
                      <p className="text-sm text-neutral-400 mt-1">
                        {result.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
