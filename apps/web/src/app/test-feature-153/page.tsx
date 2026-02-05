"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";
import { logger } from '@/lib/safe-logger';

interface VerificationResult {
  success: boolean;
  jobId?: string;
  verification?: {
    jobIdReturned: boolean;
    dbRecordCreated: boolean;
    dbStatus: string;
    bullmqJobId: string;
    bullmqEnqueued: boolean;
    responseTimeMs: number;
    fastResponse: boolean;
  };
  error?: string;
}

export default function TestFeature153Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<unknown[]>([]);

  const runTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/test-generate", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/test-generate");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      logger.error("Failed to load jobs", err);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black uppercase tracking-wider">
          Feature #153 Test
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          /// Plan generation creates BullMQ job
        </p>

        <div className="mt-8 space-y-4">
          {/* Test Steps */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-bold uppercase text-primary">
              Verification Steps
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>✅ Call generatePlan with valid intake data</li>
              <li>✅ Verify jobId is returned immediately</li>
              <li>✅ Verify PlanGenerationJob record created in DB with status &apos;pending&apos;</li>
              <li>✅ Verify BullMQ job enqueued</li>
              <li>✅ Verify response time is fast (not waiting for generation)</li>
            </ul>
          </div>

          {/* Run Test Button */}
          <button
            onClick={runTest}
            disabled={loading}
            className="w-full rounded-lg bg-primary px-6 py-4 text-sm font-black uppercase tracking-wider text-background transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Running Test..." : "Run Feature #153 Test"}
          </button>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                result.success
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <h3
                className={`text-sm font-bold uppercase ${
                  result.success ? "text-green-500" : "text-red-500"
                }`}
              >
                {result.success ? "✅ ALL CHECKS PASSED" : "❌ TEST FAILED"}
              </h3>

              {result.success && result.verification && (
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job ID Returned:</span>
                    <span className={result.verification.jobIdReturned ? "text-green-500" : "text-red-500"}>
                      {result.verification.jobIdReturned ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job ID:</span>
                    <span className="text-foreground">{result.jobId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DB Record Created:</span>
                    <span className={result.verification.dbRecordCreated ? "text-green-500" : "text-red-500"}>
                      {result.verification.dbRecordCreated ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DB Status:</span>
                    <span className="text-foreground">{result.verification.dbStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BullMQ Job Enqueued:</span>
                    <span className={result.verification.bullmqEnqueued ? "text-green-500" : "text-red-500"}>
                      {result.verification.bullmqEnqueued ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BullMQ Job ID:</span>
                    <span className="text-foreground">{result.verification.bullmqJobId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className={result.verification.fastResponse ? "text-green-500" : "text-amber-500"}>
                      {result.verification.responseTimeMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fast Response (&lt;2s):</span>
                    <span className={result.verification.fastResponse ? "text-green-500" : "text-red-500"}>
                      {result.verification.fastResponse ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}

              {result.error && (
                <p className="mt-3 text-sm text-red-500">{result.error}</p>
              )}
            </div>
          )}

          {/* View Jobs */}
          <div className="flex gap-2">
            <button
              onClick={loadJobs}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted"
            >
              View DB Jobs
            </button>
          </div>

          {jobs.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-bold uppercase text-muted-foreground">
                Recent Jobs ({jobs.length})
              </h3>
              <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                {JSON.stringify(jobs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
