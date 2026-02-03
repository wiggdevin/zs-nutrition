"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/navigation/NavBar";

interface SwapRecord {
  id: string;
  dayNumber: number;
  slot: string;
  originalMeal: string;
  newMeal: string;
  createdAt: string;
}

export default function TestFeature137Page() {
  const [status, setStatus] = useState("Setting up test environment...");
  const [error, setError] = useState<string | null>(null);
  const [swapHistory, setSwapHistory] = useState<SwapRecord[]>([]);

  useEffect(() => {
    async function setupTestEnvironment() {
      try {
        setStatus("Creating dev user and signing in...");

        // Step 1: Sign in as dev user
        const signInRes = await fetch("/api/dev-auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "dev@zsnutrition.test" }),
        });

        if (!signInRes.ok) {
          throw new Error("Failed to sign in as dev user");
        }

        const signInData = await signInRes.json();
        console.log("Signed in:", signInData.userId);

        // Step 2: Create profile if needed
        setStatus("Creating user profile...");
        const profileRes = await fetch("/api/dev-complete-onboarding", {
          method: "POST",
        });

        if (!profileRes.ok) {
          // Might already exist, that's ok
          console.log("Profile might already exist");
        }

        // Step 3: Create meal plan
        setStatus("Creating meal plan...");
        const planRes = await fetch("/api/seed-plan", {
          method: "POST",
        });

        if (!planRes.ok) {
          const planError = await planRes.json();
          // Plan might already exist, try to get active plan
          console.log("Plan might already exist:", planError.error);
        } else {
          const planData = await planRes.json();
          console.log("Plan created:", planData.planId);
        }

        setStatus("✅ Test environment ready! Redirecting to meal plan...");

        // Redirect to meal plan after 2 seconds
        setTimeout(() => {
          window.location.href = "/meal-plan";
        }, 2000);
      } catch (err: any) {
        console.error("Setup error:", err);
        setError(err.message || "Failed to set up test environment");
        setStatus("❌ Setup failed");
      }
    }

    setupTestEnvironment();
  }, []);

  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8">
              <div className="mb-6">
                <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
                  /// FEATURE TEST
                </p>
                <h1 className="mt-2 text-2xl font-bold uppercase tracking-wider text-[#fafafa]">
                  Feature #137: Meal Swap Undo
                </h1>
                <p className="mt-2 text-sm text-[#a1a1aa]">
                  Testing that undo functionality reverts to original meal
                </p>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-4">
                  <p className="text-sm font-semibold text-red-500">Setup Error</p>
                  <p className="mt-1 text-xs text-red-400">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold uppercase text-[#0a0a0a] hover:bg-red-600"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/20">
                      <svg
                        className="h-4 w-4 animate-spin text-[#f97316]"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-[#a1a1aa]">{status}</p>
                  </div>

                  <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
                    <p className="text-xs font-semibold text-[#a1a1aa] mb-2">Test Steps:</p>
                    <ol className="space-y-1 text-xs text-[#a1a1aa] list-decimal list-inside">
                      <li>Sign in as dev user</li>
                      <li>Create user profile</li>
                      <li>Generate meal plan with 7 days</li>
                      <li>Redirect to /meal-plan</li>
                      <li>Click swap icon on a meal</li>
                      <li>Select alternative meal</li>
                      <li>Wait for swap to complete</li>
                      <li>Click undo button (blue circular icon)</li>
                      <li>Verify original meal is restored</li>
                    </ol>
                  </div>

                  <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
                    <p className="text-xs font-semibold text-[#a1a1aa] mb-2">Expected Result:</p>
                    <p className="text-xs text-[#22c55e]">
                      ✓ Original meal name should reappear after undo
                    </p>
                    <p className="text-xs text-[#22c55e]">
                      ✓ Undo button should disappear after click
                    </p>
                    <p className="text-xs text-[#22c55e]">
                      ✓ Swap history record should be deleted
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
