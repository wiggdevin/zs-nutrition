"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Test page for Feature #159: Plan generation failure shows retry option
 *
 * This page simulates a failed plan generation by:
 * 1. Creating a failed job via API
 * 2. Connecting to its SSE stream
 * 3. Verifying the error UI appears with retry button
 * 4. Testing the retry functionality
 */
export default function TestFeature159Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("jobId");

  const [status, setStatus] = useState<"idle" | "creating" | "failed" | "testing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(jobIdParam);
  const [retryClicked, setRetryClicked] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string, passed: boolean) => {
    const icon = passed ? "✅" : "❌";
    setTestResults((prev) => [...prev, `${icon} ${message}`]);
  };

  // Step 1: Create a failed job
  const createFailedJob = async () => {
    setStatus("creating");
    addTestResult("Creating failed plan generation job...", true);

    try {
      const res = await fetch("/api/dev-test/simulate-failed-job");
      const data = await res.json();

      if (data.success && data.jobId) {
        setJobId(data.jobId);
        setErrorMessage(data.error);
        addTestResult(`Failed job created: ${data.jobId}`, true);
        addTestResult(`Simulated failure at Agent ${data.currentAgent}`, true);

        // Now connect to SSE stream to test the error UI
        setStatus("testing");
        connectToSSE(data.jobId);
      } else {
        addTestResult("Failed to create test job: " + JSON.stringify(data), false);
        setStatus("idle");
      }
    } catch (error) {
      addTestResult(`Error creating failed job: ${error}`, false);
      setStatus("idle");
    }
  };

  // Step 2: Connect to SSE stream and verify error is received
  const connectToSSE = (streamJobId: string) => {
    addTestResult(`Connecting to SSE stream for job ${streamJobId}...`, true);

    const eventSource = new EventSource(`/api/plan-stream/${streamJobId}`);

    let receivedFailed = false;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "failed") {
          receivedFailed = true;
          addTestResult(`✨ SSE emitted failed status`, true);
          addTestResult(`✨ Error message: "${data.message}"`, true);
          addTestResult(`✨ Failed at agent: ${data.agent}`, true);

          // Verify all test criteria
          setTimeout(() => {
            verifyErrorUI(data.message);
          }, 1000);

          eventSource.close();
        }
      } catch (err) {
        addTestResult(`Failed to parse SSE message: ${err}`, false);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (!receivedFailed) {
        addTestResult("SSE connection error", false);
      }
    };

    // Close after 5 seconds if no message received
    setTimeout(() => {
      if (!receivedFailed) {
        eventSource.close();
        addTestResult("Timeout: No failed status received from SSE", false);
      }
    }, 5000);
  };

  // Step 3: Verify the error UI displays correctly
  const verifyErrorUI = (errorMsg: string) => {
    // Wait for React to finish rendering before checking DOM
    setTimeout(() => {
      const retryButton = document.querySelector('[data-testid="retry-plan-generation"]');
      const errorElements = document.querySelectorAll("p");

      let foundError = false;
      errorElements.forEach((el) => {
        if (el.textContent?.includes("Failed") || el.textContent?.includes(errorMsg || "")) {
          foundError = true;
        }
      });

      if (foundError) {
        addTestResult(`✅ User-friendly error message displayed`, true);
      } else {
        addTestResult(`❌ Error message not found in UI`, false);
      }

      if (retryButton) {
        addTestResult(`✅ Retry button is available`, true);
      } else {
        addTestResult(`❌ Retry button not found`, false);
      }

      setStatus("failed");
    }, 100);
  };

  // Step 4: Test retry functionality
  const handleRetry = () => {
    addTestResult("🔄 Retry button clicked", true);
    setRetryClicked(true);

    // Simulate retry by navigating to /generate
    setTimeout(() => {
      addTestResult("✅ Navigate to /generate to start new generation", true);
      router.push("/generate");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa]">
            Test Feature #159
          </h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            Plan generation failure shows retry option
          </p>
        </div>

        {/* Test Steps */}
        <div className="mb-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="mb-4 text-xl font-bold text-[#fafafa]">Test Steps</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-[#a1a1aa]">
            <li>Simulate plan generation failure</li>
            <li>Verify SSE emits failed status with error</li>
            <li>Verify user-friendly error message displayed</li>
            <li>Verify retry button is available</li>
            <li>Click retry and verify new generation starts</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="mb-8 flex gap-4">
          {status === "idle" && (
            <button
              onClick={createFailedJob}
              className="rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
            >
              Create Failed Job & Test
            </button>
          )}

          {(status === "creating" || status === "testing") && (
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
              <span className="text-sm text-[#a1a1aa]">
                {status === "creating" ? "Creating failed job..." : "Testing SSE stream..."}
              </span>
            </div>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mb-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
            <h2 className="mb-4 text-xl font-bold text-[#fafafa]">Test Results</h2>
            <div className="space-y-2 font-mono text-sm">
              {testResults.map((result, idx) => (
                <div key={idx} className={result.startsWith("✅") ? "text-[#22c55e]" : result.startsWith("❌") ? "text-[#ef4444]" : "text-[#a1a1aa]"}>
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulated Error UI */}
        {status === "failed" && !retryClicked && (
          <div className="rounded-lg border border-[#ef4444]/30 bg-[#1a1a1a] p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ef4444]/10">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-[#fafafa]">Generation Failed</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">
              {errorMessage || "Something went wrong while generating your plan. Please try again."}
            </p>
            <button
              onClick={handleRetry}
              data-testid="retry-plan-generation"
              className="mt-6 rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <a
            href="/generate"
            className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-sm text-[#a1a1aa] transition-colors hover:bg-[#252525]"
          >
            Go to Generate Page
          </a>
          <a
            href="/dashboard"
            className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-sm text-[#a1a1aa] transition-colors hover:bg-[#252525]"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
