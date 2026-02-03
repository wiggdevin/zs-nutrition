"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type GenerationStatus = "idle" | "generating" | "enqueued" | "completed" | "failed";

const agentStages = [
  { number: 1, name: "Intake Normalizer", desc: "Cleaning and validating your data..." },
  { number: 2, name: "Metabolic Calculator", desc: "Calculating BMR, TDEE, and macro targets..." },
  { number: 3, name: "Recipe Curator", desc: "AI generating meal ideas matching your targets..." },
  { number: 4, name: "Nutrition Compiler", desc: "Verifying nutrition data via FatSecret..." },
  { number: 5, name: "QA Validator", desc: "Enforcing calorie and macro tolerances..." },
  { number: 6, name: "Brand Renderer", desc: "Generating your deliverables..." },
];

export function GeneratePlanPage() {
  const router = useRouter();
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [currentAgent, setCurrentAgent] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasNavigated = useRef(false);
  const isSubmitting = useRef(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const profile = localStorage.getItem("zsn_user_profile");
    const onboardingComplete = localStorage.getItem("zsn_onboarding_complete");
    setHasProfile(!!profile && onboardingComplete === "true");
  }, []);

  // Auto-navigate to /meal-plan when generation completes
  useEffect(() => {
    if (status === "completed" && !hasNavigated.current) {
      hasNavigated.current = true;
      // Brief delay to show completion state before navigating
      const timer = setTimeout(() => {
        router.push("/meal-plan");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const connectToSSE = (streamJobId: string) => {
    const eventSource = new EventSource(`/api/plan-stream/${streamJobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.agent) {
          setCurrentAgent(data.agent);
        }

        if (data.status === "completed") {
          setStatus("completed");
          localStorage.setItem("zsn_plan_generated", "true");
          if (data.planId) {
            localStorage.setItem("zsn_plan_id", data.planId);
          }
          eventSource.close();
        } else if (data.status === "failed") {
          setErrorMessage(data.message || "Plan generation failed");
          setStatus("failed");
          eventSource.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // SSE connection failed - show error state with retry option
      eventSource.close();
      console.warn("SSE connection failed: network error during plan generation stream");
      setErrorMessage(
        "Network connection lost during plan generation. Your plan may still be processing — please retry to check status."
      );
      setStatus("failed");
    };

    return eventSource;
  };

  const simulateAgentProgress = async () => {
    // Fallback: Simulate agent pipeline progression for visual feedback
    for (let i = 1; i <= 6; i++) {
      setCurrentAgent(i);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setStatus("completed");
    localStorage.setItem("zsn_plan_generated", "true");
  };

  const handleGenerate = async () => {
    // Prevent duplicate submissions - ref check is synchronous (works within same tick)
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    setStatus("generating");
    setCurrentAgent(1);
    setErrorMessage(null);

    // Get profile data from localStorage (saved during onboarding)
    const profileStr = localStorage.getItem("zsn_user_profile");
    if (!profileStr) {
      setErrorMessage("Profile data not found. Please complete onboarding first.");
      setStatus("failed");
      return;
    }

    try {
      // Create the plan generation job via API (server prevents duplicate jobs)
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        localStorage.setItem("zsn_plan_job_id", data.jobId);
        setStatus("enqueued");
        // Connect to SSE stream for real-time progress
        connectToSSE(data.jobId);
        return;
      }

      // Non-ok response or missing jobId — show error
      // Prefer message field (more detailed) over error field
      setErrorMessage(
        data.message || data.error || "Failed to start plan generation. Please try again."
      );
      setStatus("failed");
      isSubmitting.current = false;
    } catch (err) {
      console.error("Error starting plan generation:", err);
      setErrorMessage(
        "Network error while starting plan generation. Please check your connection and try again."
      );
      setStatus("failed");
      isSubmitting.current = false;
    }
  };

  const handleRetry = () => {
    isSubmitting.current = false;
    setStatus("idle");
    setCurrentAgent(0);
    setJobId(null);
    setErrorMessage(null);
  };

  // Not completed onboarding
  if (!hasProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-lg text-center">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#f59e0b] bg-[#f59e0b]/10">
              <span className="text-2xl">&#x26A0;&#xFE0F;</span>
            </div>
            <h2 className="text-xl font-bold text-[#fafafa]">
              Complete Onboarding First
            </h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">
              You need to complete your profile setup before generating a meal plan.
            </p>
            <a
              href="/onboarding"
              className="mt-6 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
            >
              Go to Onboarding
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Generating/enqueued state - full screen with agent progress
  if (status === "generating" || status === "enqueued") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-lg">
          <div className="text-center">
            <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa]">
              Generating Plan
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
              /// NUTRITION ENGINE ACTIVE
            </p>
            {jobId && (
              <p className="mt-1 font-mono text-[10px] text-[#a1a1aa]/50">
                Job: {jobId}
              </p>
            )}
          </div>

          <div className="mt-8 space-y-3">
            {agentStages.map((agent) => (
              <div
                key={agent.number}
                className={`rounded-lg border p-4 transition-all duration-500 ${
                  agent.number < currentAgent
                    ? "border-[#22c55e]/30 bg-[#22c55e]/5"
                    : agent.number === currentAgent
                    ? "border-[#f97316]/50 bg-[#f97316]/5"
                    : "border-[#2a2a2a] bg-[#1a1a1a] opacity-40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      agent.number < currentAgent
                        ? "bg-[#22c55e] text-white"
                        : agent.number === currentAgent
                        ? "bg-[#f97316] text-[#0a0a0a]"
                        : "bg-[#2a2a2a] text-[#a1a1aa]"
                    }`}
                  >
                    {agent.number < currentAgent ? "\u2713" : agent.number}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold ${
                        agent.number <= currentAgent
                          ? "text-[#fafafa]"
                          : "text-[#a1a1aa]"
                      }`}
                    >
                      Agent {agent.number}: {agent.name}
                    </p>
                    {agent.number === currentAgent && (
                      <p className="text-xs text-[#a1a1aa]">{agent.desc}</p>
                    )}
                  </div>
                  {agent.number === currentAgent && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Completed state
  if (status === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-lg text-center">
          <div className="rounded-lg border border-[#22c55e]/30 bg-[#1a1a1a] p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#22c55e]/10">
              <span className="text-4xl">&#x1F389;</span>
            </div>
            <h2 className="text-2xl font-heading uppercase tracking-wider text-[#fafafa]">
              Plan Generated!
            </h2>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#22c55e]">
              /// ALL 6 AGENTS COMPLETE
            </p>
            <p className="mt-4 text-sm text-[#a1a1aa]">
              Your personalized 7-day meal plan is ready.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
              <span className="text-sm text-[#f97316] font-mono uppercase tracking-wide">
                Redirecting to your meal plan...
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/meal-plan"
                className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
              >
                View Meal Plan
              </a>
              <a
                href="/dashboard"
                className="inline-block rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#fafafa] transition-colors hover:bg-[#252525]"
              >
                View Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (status === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-lg text-center">
          <div className="rounded-lg border border-[#ef4444]/30 bg-[#1a1a1a] p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ef4444]/10">
              <span className="text-2xl">&#x274C;</span>
            </div>
            <h2 className="text-xl font-bold text-[#fafafa]">
              Generation Failed
            </h2>
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
        </div>
      </div>
    );
  }

  // Idle state - ready to generate
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-lg text-center">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
            /// ZERO SUM NUTRITION
          </p>
          <h1 className="text-4xl font-heading uppercase tracking-wider text-[#fafafa]">
            Generate Your
            <span className="block text-[#f97316]">Protocol</span>
          </h1>
        </div>

        <div className="mt-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
          <p className="text-sm text-[#a1a1aa]">
            Your profile is ready. Our 6-agent AI pipeline will create a
            personalized 7-day meal plan with verified nutrition data, optimized
            for your goals.
          </p>

          <div className="mt-6 space-y-2">
            {agentStages.map((agent) => (
              <div
                key={agent.number}
                className="flex items-center gap-3 rounded border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-bold text-[#a1a1aa]">
                  {agent.number}
                </span>
                <span className="text-xs text-[#a1a1aa]">{agent.name}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={status !== "idle"}
            className={`mt-6 w-full rounded-lg px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition-colors ${
              status !== "idle"
                ? "cursor-not-allowed bg-[#f97316]/50"
                : "bg-[#f97316] hover:bg-[#ea580c]"
            }`}
          >
            {status !== "idle" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </span>
            ) : (
              "Generate Plan"
            )}
          </button>

          <p className="mt-3 font-mono text-[10px] text-[#a1a1aa]/50">
            Estimated time: 30-120 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
