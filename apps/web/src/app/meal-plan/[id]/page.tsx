"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/navigation/NavBar";

interface PlanSummary {
  id: string;
  dailyKcalTarget: number | null;
  planDays: number;
  qaScore: number | null;
  status: string;
  isActive?: boolean;
}

/**
 * /meal-plan/[id] — View a specific meal plan by ID.
 *
 * Security: The API route (/api/plan/[id]) filters by authenticated userId,
 * so users can ONLY access their own plans. Attempting to access another
 * user's plan via URL manipulation returns 404.
 */
export default function MealPlanByIdPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plan/${planId}`);
        setStatusCode(res.status);

        if (res.status === 401) {
          setError("You must be signed in to view this plan.");
          return;
        }

        if (res.status === 404) {
          setError("Meal plan not found or access denied.");
          return;
        }

        if (!res.ok) {
          setError("Failed to load meal plan.");
          return;
        }

        const data = await res.json();
        setPlan(data.plan);
      } catch {
        setError("Failed to load meal plan. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    if (planId) {
      fetchPlan();
    }
  }, [planId]);

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading meal plan...</p>
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
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md text-center" data-testid="plan-access-denied">
              <div className="rounded-lg border border-border bg-card p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <span className="text-2xl">
                    {statusCode === 401 ? "🔒" : "🚫"}
                  </span>
                </div>
                <h2
                  className="text-xl font-bold text-foreground"
                  data-testid="access-denied-title"
                >
                  {statusCode === 401 ? "Authentication Required" : "Plan Not Found"}
                </h2>
                <p
                  className="mt-2 text-sm text-muted-foreground"
                  data-testid="access-denied-message"
                >
                  {error}
                </p>
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  data-testid="access-denied-detail"
                >
                  {statusCode === 404
                    ? "This meal plan may have been deleted or does not exist."
                    : "Please sign in to continue."}
                </p>
                <div className="mt-6 flex flex-col gap-3 items-center">
                  <button
                    onClick={() => router.push("/meal-plan")}
                    className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
                    data-testid="back-to-plans-button"
                  >
                    Go to My Plans
                  </button>
                  {statusCode === 401 && (
                    <button
                      onClick={() => router.push("/sign-in")}
                      className="inline-block rounded-lg border border-border px-6 py-3 text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-secondary"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Handle replaced/inactive plans - show appropriate message with link to current plan
  if (plan && (plan.status === 'replaced' || plan.isActive === false)) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md text-center" data-testid="plan-replaced-state">
              <div className="rounded-lg border border-border bg-card p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                  <span className="text-2xl">📋</span>
                </div>
                <h2
                  className="text-xl font-bold text-foreground"
                  data-testid="plan-replaced-title"
                >
                  Plan No Longer Active
                </h2>
                <p
                  className="mt-2 text-sm text-muted-foreground"
                  data-testid="plan-replaced-message"
                >
                  This meal plan has been replaced by a newer plan.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.planDays}-day plan &middot; {plan.dailyKcalTarget} kcal/day
                </p>
                <div className="mt-6 flex flex-col gap-3 items-center">
                  <button
                    onClick={() => router.push("/meal-plan")}
                    className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
                    data-testid="view-current-plan-button"
                  >
                    View Current Plan
                  </button>
                  <button
                    onClick={() => router.push("/generate")}
                    className="inline-block rounded-lg border border-border px-6 py-3 text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-secondary"
                    data-testid="generate-new-plan-button"
                  >
                    Generate New Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // If we have a valid active plan that belongs to this user, redirect to the main meal-plan page
  if (plan) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md text-center">
              <div className="rounded-lg border border-border bg-card p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <span className="text-2xl">✅</span>
                </div>
                <h2 className="text-xl font-bold text-foreground" data-testid="plan-found-title">
                  Meal Plan Found
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.planDays}-day plan &middot; {plan.dailyKcalTarget} kcal/day
                  {plan.qaScore !== null && ` · QA: ${plan.qaScore}%`}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push("/meal-plan")}
                    className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
                    data-testid="view-plan-button"
                  >
                    View Full Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
