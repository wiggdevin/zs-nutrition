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
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black uppercase tracking-wider">
          Feature #148 Test
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          /// FatSecret adapter autocomplete returns suggestions
        </p>

        <div className="mt-8 space-y-4">
          {/* Test Steps */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-bold uppercase text-primary">
              Verification Steps
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✅ Call autocomplete with query 'chick'</li>
              <li>✅ Verify array of string suggestions returned</li>
              <li>✅ Verify suggestions are relevant to query</li>
              <li>✅ Verify response is fast (under 500ms)</li>
            </ul>
          </div>

          {/* Query Input */}
          <div className="rounded-lg border border-border bg-card p-4">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Test Query
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 rounded bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="Enter search query..."
              />
              <button
                onClick={() => runTest(query)}
                disabled={loading || query.length < 2}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-black uppercase tracking-wider text-background transition-colors hover:bg-primary/90 disabled:opacity-50"
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
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Test "chick"
            </button>
            <button
              onClick={() => { setQuery("chicken"); runTest("chicken"); }}
              disabled={loading}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Test "chicken"
            </button>
            <button
              onClick={() => { setQuery("broc"); runTest("broc"); }}
              disabled={loading}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Test "broc"
            </button>
            <button
              onClick={() => { setQuery("sal"); runTest("sal"); }}
              disabled={loading}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Test "sal"
            </button>
          </div>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                !result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <h3
                className={`text-sm font-bold uppercase ${
                  !result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {!result.error && result.isArray && result.hasRelevantSuggestions && result.isFast
                  ? "✅ ALL CHECKS PASSED"
                  : "❌ TEST FAILED"}
              </h3>

              {!result.error && (
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Query:</span>
                    <span className="text-foreground">&quot;{result.query}&quot;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Array Returned:</span>
                    <span className={result.isArray ? "text-green-500" : "text-red-500"}>
                      {result.isArray ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Suggestion Count:</span>
                    <span className={result.suggestionCount > 0 ? "text-green-500" : "text-amber-500"}>
                      {result.suggestionCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Relevant to Query:</span>
                    <span className={result.hasRelevantSuggestions ? "text-green-500" : "text-red-500"}>
                      {result.hasRelevantSuggestions ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className={result.isFast ? "text-green-500" : "text-amber-500"}>
                      {result.responseTimeMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fast Response (&lt;500ms):</span>
                    <span className={result.isFast ? "text-green-500" : "text-red-500"}>
                      {result.isFast ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Suggestions:
                  </h4>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="font-mono text-xs text-foreground bg-background px-3 py-2 rounded">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.error && (
                <p className="mt-3 text-sm text-red-500">Error: {result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
