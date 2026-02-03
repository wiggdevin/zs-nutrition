"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function SettingsPlanHistory() {
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
        setError("Failed to load plan history");
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#fafafa]">Plan History</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Loading...</p>
          </div>
          <div className="h-6 w-24 rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#fafafa]">Plan History</h2>
            <p className="mt-1 text-sm text-[#ef4444]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#fafafa]">Plan History</h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">
            {plans.length === 0
              ? "No plans generated yet"
              : `${plans.length} ${plans.length === 1 ? "plan" : "plans"} generated`}
          </p>
        </div>
        {plans.length > 0 && (
          <Link
            href="/meal-plan/history"
            className="text-sm font-medium text-[#f97316] hover:text-[#ea580c] transition-colors"
          >
            View All →
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[#a1a1aa]">
            Generate your first meal plan to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.slice(0, 3).map((plan) => (
            <Link
              key={plan.id}
              href={`/meal-plan/${plan.id}`}
              className="block rounded border border-[#2a2a2a] bg-[#0a0a0a] p-4 transition-all hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
              data-testid={`settings-plan-card-${plan.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    {plan.isActive ? (
                      <span
                        className="rounded bg-[#22c55e]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#22c55e]"
                        data-testid={`settings-active-badge-${plan.id}`}
                      >
                        ✓ Active
                      </span>
                    ) : (
                      <span
                        className="rounded bg-[#a1a1aa]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#a1a1aa]"
                        data-testid={`settings-inactive-badge-${plan.id}`}
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
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          plan.qaScore >= 80
                            ? "bg-[#22c55e]/20 text-[#22c55e]"
                            : plan.qaScore >= 60
                            ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                            : "bg-[#ef4444]/20 text-[#ef4444]"
                        }`}
                        data-testid={`settings-qa-score-${plan.id}`}
                      >
                        QA: {plan.qaScore}%
                      </span>
                    )}
                  </div>

                  {/* Plan Title */}
                  <h3
                    className="text-sm font-semibold text-[#fafafa] truncate"
                    data-testid={`settings-plan-title-${plan.id}`}
                  >
                    {plan.planDays}-Day Plan
                    {plan.profile?.goalType && ` · ${plan.profile.goalType}`}
                  </h3>

                  {/* Generated Date */}
                  <p
                    className="mt-1 text-xs text-[#a1a1aa]"
                    data-testid={`settings-plan-date-${plan.id}`}
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
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
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
                  className="w-4 h-4 flex-shrink-0 text-[#a1a1aa]"
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

          {plans.length > 3 && (
            <Link
              href="/meal-plan/history"
              className="block rounded border border-[#2a2a2a] bg-[#0a0a0a] p-3 text-center text-sm text-[#a1a1aa] transition-all hover:border-[#3a3a3a] hover:bg-[#1a1a1a] hover:text-[#fafafa]"
            >
              View {plans.length - 3} more {plans.length - 3 === 1 ? "plan" : "plans"} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
