'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import type { PlanData } from './types';

export type MealPlanTab = 'meal-plan' | 'grocery-list' | 'history';

interface DayNavigatorProps {
  activeTab: MealPlanTab;
  onTabChange: (tab: MealPlanTab) => void;
  plan: PlanData;
}

export function DayNavigator({ activeTab, onTabChange, plan }: DayNavigatorProps) {
  return (
    <>
      <PageHeader
        label="ZERO SUM NUTRITION"
        title="Your Meal Plan"
        subtitle={
          <>
            {plan.profile && (
              <span>
                {plan.profile.name} &middot; {plan.profile.goalType} &middot; {plan.planDays}-day
                plan
              </span>
            )}
            {plan.generatedAt && (
              <span className="block text-xs" data-testid="plan-generated-date">
                Generated{' '}
                {new Date(plan.generatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </>
        }
        maxWidth="full"
        actions={<PlanHeaderActions plan={plan} />}
      />

      {/* Tab Navigation */}
      <div className="mx-auto max-w-[1600px] px-4 pt-6">
        <div className="flex gap-2 border-b border-border" data-testid="meal-plan-tabs">
          <button
            onClick={() => onTabChange('meal-plan')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'meal-plan'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
            data-testid="tab-meal-plan"
            aria-label="View meal plan"
            aria-selected={activeTab === 'meal-plan'}
          >
            📅 Meal Plan
          </button>
          <button
            onClick={() => onTabChange('grocery-list')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'grocery-list'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
            data-testid="tab-grocery-list"
            aria-label="View grocery list"
            aria-selected={activeTab === 'grocery-list'}
          >
            🛒 Grocery List
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
            data-testid="tab-history"
            aria-label="View plan version history"
            aria-selected={activeTab === 'history'}
          >
            🕐 History
          </button>
        </div>
      </div>
    </>
  );
}

function PlanHeaderActions({ plan }: { plan: PlanData }) {
  return (
    <div className="flex items-center gap-4">
      {plan.version !== null && plan.version !== undefined && (
        <span
          className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
          data-testid="plan-version-badge"
          title={`Plan version ${plan.version}`}
        >
          v{plan.version}
        </span>
      )}
      {plan.qaStatus && (
        <div
          className="rounded-lg border px-3 py-2 text-center"
          style={{
            backgroundColor:
              plan.qaStatus === 'PASS'
                ? 'rgba(34, 197, 94, 0.1)'
                : plan.qaStatus === 'WARN'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
            borderColor:
              plan.qaStatus === 'PASS'
                ? 'rgba(34, 197, 94, 0.3)'
                : plan.qaStatus === 'WARN'
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)',
          }}
          title={`QA Status: ${plan.qaStatus}${plan.qaScore !== null ? ` (${plan.qaScore}%)` : ''}`}
          data-testid="qa-score-badge"
        >
          <p className="font-mono text-xs text-muted-foreground">QA Score</p>
          <p
            className="text-lg font-bold"
            style={{
              color:
                plan.qaStatus === 'PASS'
                  ? 'var(--color-success)'
                  : plan.qaStatus === 'WARN'
                    ? 'var(--color-warning)'
                    : 'var(--destructive)',
            }}
          >
            {plan.qaScore !== null ? `${plan.qaScore}%` : 'N/A'}
          </p>
        </div>
      )}
      {plan.dailyKcalTarget && (
        <div className="rounded-lg border border-border bg-card px-4 py-2">
          <p className="font-mono text-xs text-muted-foreground text-center mb-1">Daily Targets</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{plan.dailyKcalTarget}</p>
              <p className="text-[10px] text-muted-foreground">kcal</p>
            </div>
            {(plan.dailyProteinG || plan.dailyCarbsG || plan.dailyFatG) && (
              <>
                <div className="w-px h-8 bg-border"></div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {plan.dailyProteinG && (
                    <span className="text-chart-3" data-testid="daily-protein-target">
                      P {plan.dailyProteinG}g
                    </span>
                  )}
                  {plan.dailyCarbsG && (
                    <span className="text-warning" data-testid="daily-carbs-target">
                      C {plan.dailyCarbsG}g
                    </span>
                  )}
                  {plan.dailyFatG && (
                    <span className="text-destructive" data-testid="daily-fat-target">
                      F {plan.dailyFatG}g
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <PDFAndHistoryButtons pdfUrl={plan.pdfUrl} />
    </div>
  );
}

function PDFAndHistoryButtons({ pdfUrl }: { pdfUrl?: string | null }) {
  return (
    <>
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          data-testid="download-pdf-button"
          aria-label="Download meal plan as PDF"
          title="Download PDF"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 15V3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>PDF</span>
        </a>
      )}
      <Link
        href="/meal-plan/history"
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-chart-3/50 hover:bg-chart-3/10 hover:text-chart-3"
        data-testid="view-history-button"
        aria-label="View plan history"
        title="View plan history"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>History</span>
      </Link>
    </>
  );
}
