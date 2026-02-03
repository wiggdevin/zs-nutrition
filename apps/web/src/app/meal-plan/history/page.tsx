"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/navigation/NavBar";

interface PlanSummary {
  id: string;
  dailyKcalTarget: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;
  trainingBonusKcal: number | null;
  planDays: number;
  startDate: string;
  endDate: string;
  qaScore: number | null;
  qaStatus: string | null;
  status: string;
  isActive: boolean;
  generatedAt: string;
  pdfUrl: string | null;
  profile: {
    name: string;
    goalType: string;
  } | null;
}

export default function PlanHistoryPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch("/api/plan/history");
        const data = await res.json();

        if (res.ok) {
          setPlans(data.plans || []);
        } else {
          setError(data.error || "Failed to load plan history");
        }
      } catch (err) {
        console.error("Error fetching plan history:", err);
        setError("Failed to load plan history. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
            {/* Skeleton Header */}
            <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-6">
              <div className="mx-auto max-w-4xl">
                <div className="h-3 w-32 rounded skeleton-shimmer" />
                <div className="mt-2 h-7 w-48 rounded skeleton-shimmer" />
              </div>
            </div>

            {/* Skeleton List */}
            <div className="mx-auto max-w-4xl px-4 py-6">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-5">
                    <div className="h-4 w-40 rounded skeleton-shimmer" />
                    <div className="mt-2 h-3 w-24 rounded skeleton-shimmer" />
                    <div className="mt-3 h-5 w-16 rounded-full skeleton-shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
            <div className="w-full max-w-md text-center">
              <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f97316]/10">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-[#fafafa]">Error</h2>
                <p className="mt-2 text-sm text-[#a1a1aa]">{error}</p>
                <Link
                  href="/meal-plan"
                  className="mt-6 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
                >
                  Back to Meal Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (plans.length === 0) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
            <div className="w-full max-w-md text-center">
              <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f97316]/10">
                  <span className="text-2xl">📋</span>
                </div>
                <h2 className="text-xl font-bold text-[#fafafa]">No Plans Yet</h2>
                <p className="mt-2 text-sm text-[#a1a1aa]">
                  You haven't generated any meal plans yet.
                </p>
                <Link
                  href="/generate"
                  className="mt-6 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
                >
                  Generate Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
          {/* Header */}
          <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-6">
            <div className="mx-auto max-w-4xl">
              <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
                /// ZERO SUM NUTRITION
              </p>
              <h1 className="mt-1 text-2xl font-heading uppercase tracking-wider text-[#fafafa]">
                Plan History
              </h1>
              <p className="mt-1 text-sm text-[#a1a1aa]">
                {plans.length} {plans.length === 1 ? "plan" : "plans"}
              </p>
            </div>
          </div>

          {/* Plans List */}
          <div className="mx-auto max-w-4xl px-4 py-6">
            <div className="space-y-3">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/meal-plan/${plan.id}`}
                  className="block rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-all hover:border-[#3a3a3a] hover:bg-[#252525]"
                  data-testid={`plan-card-${plan.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Plan Info */}
                    <div className="flex-1 min-w-0">
                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {plan.isActive ? (
                          <span
                            className="rounded bg-[#22c55e]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#22c55e]"
                            data-testid={`active-badge-${plan.id}`}
                          >
                            ✓ Active
                          </span>
                        ) : (
                          <span
                            className="rounded bg-[#a1a1aa]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#a1a1aa]"
                            data-testid={`inactive-badge-${plan.id}`}
                          >
                            {plan.status === "replaced"
                              ? "Replaced"
                              : plan.status === "expired"
                              ? "Expired"
                              : plan.status}
                          </span>
                        )}

                        {/* QA Score */}
                        {plan.qaScore !== null && (
                          <span
                            className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              plan.qaScore >= 80
                                ? "bg-[#22c55e]/20 text-[#22c55e]"
                                : plan.qaScore >= 60
                                ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                                : "bg-[#ef4444]/20 text-[#ef4444]"
                            }`}
                          >
                            QA: {plan.qaScore}%
                          </span>
                        )}
                      </div>

                      {/* Plan Title */}
                      <h3
                        className="text-base font-semibold text-[#fafafa] truncate"
                        data-testid={`plan-title-${plan.id}`}
                      >
                        {plan.planDays}-Day Plan
                        {plan.profile?.goalType && ` · ${plan.profile.goalType}`}
                      </h3>

                      {/* Generated Date */}
                      <p
                        className="mt-1 text-xs text-[#a1a1aa]"
                        data-testid={`plan-date-${plan.id}`}
                      >
                        Generated{" "}
                        {new Date(plan.generatedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>

                      {/* Macros */}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        {plan.dailyKcalTarget && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-[#f97316]">
                              {plan.dailyKcalTarget}
                            </span>
                            <span className="text-[#a1a1aa]">kcal/day</span>
                          </div>
                        )}
                        {plan.dailyProteinG && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-[#3b82f6]">
                              {plan.dailyProteinG}g
                            </span>
                            <span className="text-[#a1a1aa]">protein</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow Icon */}
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-[#a1a1aa]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
