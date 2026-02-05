'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/safe-logger';

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
        const res = await fetch('/api/plan/history');
        const data = await res.json();

        if (res.ok) {
          setPlans(data.plans || []);
        } else {
          setError(data.error || 'Failed to load plan history');
        }
      } catch (err) {
        logger.error('Error fetching plan history:', err);
        setError('Failed to load plan history');
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plan History</h2>
            <p className="mt-1 text-sm text-muted-foreground">Loading...</p>
          </div>
          <div className="h-6 w-24 rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plan History</h2>
            <p className="mt-1 text-sm text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plan History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {plans.length === 0
              ? 'No plans generated yet'
              : `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'} generated`}
          </p>
        </div>
        {plans.length > 0 && (
          <Link
            href="/meal-plan/history"
            className="text-sm font-medium text-primary hover:text-primary/90 transition-colors"
          >
            View All →
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Generate your first meal plan to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.slice(0, 3).map((plan) => (
            <Link
              key={plan.id}
              href={`/meal-plan/${plan.id}`}
              className="block rounded border border-border bg-background p-4 transition-all hover:border-border/80 hover:bg-card"
              data-testid={`settings-plan-card-${plan.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    {plan.isActive ? (
                      <span
                        className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success"
                        data-testid={`settings-active-badge-${plan.id}`}
                      >
                        ✓ Active
                      </span>
                    ) : (
                      <span
                        className="rounded bg-muted-foreground/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                        data-testid={`settings-inactive-badge-${plan.id}`}
                      >
                        {plan.status === 'replaced'
                          ? 'Replaced'
                          : plan.status === 'expired'
                            ? 'Expired'
                            : plan.status}
                      </span>
                    )}

                    {/* QA Score */}
                    {plan.qaScore !== null && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          plan.qaScore >= 80
                            ? 'bg-success/20 text-success'
                            : plan.qaScore >= 60
                              ? 'bg-warning/20 text-warning'
                              : 'bg-destructive/20 text-destructive'
                        }`}
                        data-testid={`settings-qa-score-${plan.id}`}
                      >
                        QA: {plan.qaScore}%
                      </span>
                    )}
                  </div>

                  {/* Plan Title */}
                  <h3
                    className="text-sm font-semibold text-foreground truncate"
                    data-testid={`settings-plan-title-${plan.id}`}
                  >
                    {plan.planDays}-Day Plan
                    {plan.profile?.goalType && ` · ${plan.profile.goalType}`}
                  </h3>

                  {/* Generated Date */}
                  <p
                    className="mt-1 text-xs text-muted-foreground"
                    data-testid={`settings-plan-date-${plan.id}`}
                  >
                    Generated{' '}
                    {new Date(plan.generatedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>

                  {/* Macros */}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {plan.dailyKcalTarget && (
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-primary">
                          {plan.dailyKcalTarget}
                        </span>
                        <span className="text-muted-foreground">kcal/day</span>
                      </div>
                    )}
                    {plan.dailyProteinG && (
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-chart-3">
                          {plan.dailyProteinG}g
                        </span>
                        <span className="text-muted-foreground">protein</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow Icon */}
                <svg
                  className="w-4 h-4 flex-shrink-0 text-muted-foreground"
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
              className="block rounded border border-border bg-background p-3 text-center text-sm text-muted-foreground transition-all hover:border-border/80 hover:bg-card hover:text-foreground"
            >
              View {plans.length - 3} more {plans.length - 3 === 1 ? 'plan' : 'plans'} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
