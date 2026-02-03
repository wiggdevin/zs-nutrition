"use client";

import { useState } from "react";

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
      console.error("Failed to load jobs:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-[#fafafa]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black uppercase tracking-wider">
          Feature #153 Test
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
          /// Plan generation creates BullMQ job
        </p>

        <div className="mt-8 space-y-4">
          {/* Test Steps */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
            <h2 className="text-sm font-bold uppercase text-[#f97316]">
              Verification Steps
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#a1a1aa]">
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
            className="w-full rounded-lg bg-[#f97316] px-6 py-4 text-sm font-black uppercase tracking-wider text-[#0a0a0a] transition-colors hover:bg-[#ea580c] disabled:opacity-50"
          >
            {loading ? "Running Test..." : "Run Feature #153 Test"}
          </button>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                result.success
                  ? "border-[#22c55e]/30 bg-[#22c55e]/5"
                  : "border-[#ef4444]/30 bg-[#ef4444]/5"
              }`}
            >
              <h3
                className={`text-sm font-bold uppercase ${
                  result.success ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {result.success ? "✅ ALL CHECKS PASSED" : "❌ TEST FAILED"}
              </h3>

              {result.success && result.verification && (
                <div className="mt-4 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Job ID Returned:</span>
                    <span className={result.verification.jobIdReturned ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.verification.jobIdReturned ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Job ID:</span>
                    <span className="text-[#fafafa]">{result.jobId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">DB Record Created:</span>
                    <span className={result.verification.dbRecordCreated ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.verification.dbRecordCreated ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">DB Status:</span>
                    <span className="text-[#fafafa]">{result.verification.dbStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">BullMQ Job Enqueued:</span>
                    <span className={result.verification.bullmqEnqueued ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.verification.bullmqEnqueued ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">BullMQ Job ID:</span>
                    <span className="text-[#fafafa]">{result.verification.bullmqJobId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Response Time:</span>
                    <span className={result.verification.fastResponse ? "text-[#22c55e]" : "text-[#f59e0b]"}>
                      {result.verification.responseTimeMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Fast Response (&lt;2s):</span>
                    <span className={result.verification.fastResponse ? "text-[#22c55e]" : "text-[#ef4444]"}>
                      {result.verification.fastResponse ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}

              {result.error && (
                <p className="mt-3 text-sm text-[#ef4444]">{result.error}</p>
              )}
            </div>
          )}

          {/* View Jobs */}
          <div className="flex gap-2">
            <button
              onClick={loadJobs}
              className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#a1a1aa] transition-colors hover:bg-[#252525]"
            >
              View DB Jobs
            </button>
          </div>

          {jobs.length > 0 && (
            <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
              <h3 className="text-xs font-bold uppercase text-[#a1a1aa]">
                Recent Jobs ({jobs.length})
              </h3>
              <pre className="mt-2 overflow-auto text-xs text-[#a1a1aa]">
                {JSON.stringify(jobs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
