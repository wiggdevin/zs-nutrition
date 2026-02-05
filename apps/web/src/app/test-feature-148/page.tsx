"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";

interface AutocompleteResult {
  query: string;
  suggestions: string[];
  isArray: boolean;
  suggestionCount: number;
  responseTimeMs: number;
  isFast: boolean;
  hasRelevantSuggestions: boolean;
  error?: string;
}

export default function TestFeature148Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [result, setResult] = useState<AutocompleteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("chick");

  const runTest = async (testQuery: string = "chick") => {
    setLoading(true);
    setResult(null);

    const startTime = performance.now();

    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(testQuery)}&type=autocomplete`);

      const endTime = performance.now();
      const responseTimeMs = Math.round(endTime - startTime);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const suggestions = data.results || [];

      const isArray = Array.isArray(suggestions);
      const suggestionCount = suggestions.length;
      const isFast = responseTimeMs < 500;

      // Check if suggestions are relevant to the query
      const hasRelevantSuggestions = suggestions.some((s: string) =>
        s.toLowerCase().includes(testQuery.toLowerCase())
      );

      setResult({
        query: testQuery,
        suggestions,
        isArray,
        suggestionCount,
        responseTimeMs,
        isFast,
        hasRelevantSuggestions,
      });
    } catch (err) {
      setResult({
        query: testQuery,
        suggestions: [],
        isArray: false,
        suggestionCount: 0,
        responseTimeMs: 0,
        isFast: false,
        hasRelevantSuggestions: false,
        error: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-[#fafafa]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black uppercase tracking-wider">
          Feature #148 Test
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
          /// FatSecret adapter autocomplete returns suggestions
        </p>

        <div className="mt-8 space-y-4">
          {/* Test Steps */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
            <h2 className="text-sm font-bold uppercase text-[#f97316]">
              Verification Steps
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#a1a1aa]">
              <li>✅ Call autocomplete with query 'chick'</li>
              <li>✅ Verify array of string suggestions returned</li>
              <li>✅ Verify suggestions are relevant to query</li>
              <li>✅ Verify response is fast (under 500ms)</li>
            </ul>
          </div>

          {/* Query Input */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
            <label className="text-xs font-bold uppercase text-[#a1a1aa]">
              Test Query
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 rounded bg-[#0a0a0a] border border-[#2a2a2a] px-3 py-2 text-sm text-[#fafafa] focus:outline-none focus:border-[#f97316]"
                placeholder="Enter search query..."
              />
              <button
                onClick={() => runTest(query)}
                disabled={loading || query.length < 2}
                className="rounded-lg bg-[#f97316] px-6 py-2 text-sm font-black uppercase tracking-wider text-[#0a0a0a] transition-colors hover:bg-[#ea580c] disabled:opacity-50"
              >
                {loading ? "Testing..." : "Test"}
              </button>
            </div>
          </div>

          {/* Quick Test Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setQuery("chick"); runTest("chick"); }}
              disabled={loading}
              className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#a1a1aa] transition-colors hover:bg-[#252525] disabled:opacity-50"
            >
              Test "chick"
            </button>
            <button
              onClick={() => { setQuery("chicken"); runTest("chicken"); }}
              disabled={loading}
              className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#a1a1aa] transition-colors hover:bg-[#252525] disabled:opacity-50"
            >
              Test "chicken"
            </button>
            <button
              onClick={() => { setQuery("broc"); runTest("broc"); }}
              disabled={loading}
              className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#a1a1aa] transition-colors hover:bg-[#252525] disabled:opacity-50"
            >
              Test "broc"
            </button>
            <button
              onClick={() => { setQuery("sal"); runTest("sal"); }}
              disabled={loading}
              className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#a1a1aa] transition-colors hover:bg-[#252525] disabled:opacity-50"
            >
              Test "sal"
            </button>
          </div>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                !result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                  ? "border-[#22c55e]/30 bg-[#22c55e]/5"
                  : "border-[#ef4444]/30 bg-[#ef4444]/5"
              }`}
            >
              <h3
                className={`text-sm font-bold uppercase ${
                  !result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                    ? "text-[#22c55e]"
                    : "text-[#ef4444]"
                }`}
              >
                {!result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                  ? "✅ ALL CHECKS PASSED"
                  : "❌ TEST FAILED"}
              </h3>

              {!result.error && (
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Query:</span>
                    <span className="text-[#fafafa]">&quot;{result.query}&quot;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Array Returned:</span>
                    <span className={result.isArray ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.isArray ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Suggestion Count:</span>
                    <span className={result.suggestionCount > 0 ? "text-[#22c55e]" : "text-[#f59e0b]"}>
                      {result.suggestionCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Relevant to Query:</span>
                    <span className={result.hasRelevantSuggestions ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.hasRelevantSuggestions ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Response Time:</span>
                    <span className={result.isFast ? "text-[#22c55e]" : "text-[#f59e0b]"}>
                      {result.responseTimeMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Fast Response (&lt;500ms):</span>
                    <span className={result.isFast ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.isFast ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase text-[#a1a1aa] mb-2">
                    Suggestions:
                  </h4>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="font-mono text-xs text-[#fafafa] bg-[#0a0a0a] px-3 py-2 rounded">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.error && (
                <p className="mt-3 text-sm text-[#ef4444]">Error: {result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
