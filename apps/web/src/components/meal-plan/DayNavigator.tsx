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
  const subtitleParts: string[] = [];
  if (plan.profile) {
    subtitleParts.push(plan.profile.name);
    subtitleParts.push(plan.profile.goalType);
    subtitleParts.push(`${plan.planDays}-day plan`);
  }
  if (plan.generatedAt) {
    subtitleParts.push(
      `Generated ${new Date(plan.generatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`
    );
  }

  return (
    <>
      <PageHeader
        showPrefix
        sticky
        title="Your Meal Plan"
        subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined}
        maxWidth="max"
        actions={<PlanHeaderActions plan={plan} />}
        data-testid="plan-generated-date"
      />

      {/* Tab Navigation */}
      <div className="mx-auto max-w-[2400px] px-4 md:px-6 xl:px-8 2xl:px-10 pt-6">
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
            Meal Plan
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
            Grocery List
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
            History
          </button>
        </div>
      </div>
    </>
  );
}

function PlanHeaderActions({ plan }: { plan: PlanData }) {
  return (
    <div className="flex items-center gap-2">
      {/* Inline macro strip */}
      {plan.dailyKcalTarget && (
        <span
          className="font-mono text-xs font-semibold text-muted-foreground"
          data-testid="daily-kcal-target"
        >
          {plan.dailyKcalTarget}kcal
          {(plan.dailyProteinG || plan.dailyCarbsG || plan.dailyFatG) && (
            <span className="hidden md:inline">
              <span className="mx-1">·</span>
              {plan.dailyProteinG && (
                <span className="text-chart-3" data-testid="daily-protein-target">
                  P{plan.dailyProteinG}g
                </span>
              )}
              {plan.dailyProteinG && plan.dailyCarbsG && (
                <span className="text-muted-foreground"> / </span>
              )}
              {plan.dailyCarbsG && (
                <span className="text-warning" data-testid="daily-carbs-target">
                  C{plan.dailyCarbsG}g
                </span>
              )}
              {plan.dailyCarbsG && plan.dailyFatG && (
                <span className="text-muted-foreground"> / </span>
              )}
              {plan.dailyFatG && (
                <span className="text-destructive" data-testid="daily-fat-target">
                  F{plan.dailyFatG}g
                </span>
              )}
            </span>
          )}
        </span>
      )}

      {/* Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Ghost icon buttons */}
      <PDFAndHistoryButtons pdfUrl={plan.pdfUrl} />
    </div>
  );
}

function PDFAndHistoryButtons({ pdfUrl }: { pdfUrl?: string | null }) {
  return (
    <div className="flex items-center gap-1">
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          data-testid="download-pdf-button"
          aria-label="Download meal plan as PDF"
          title="Download PDF"
        >
          <svg
            width="14"
            height="14"
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
          <span className="sr-only">PDF</span>
        </a>
      )}
      <Link
        href="/meal-plan/history"
        className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        data-testid="view-history-button"
        aria-label="View plan history"
        title="View plan history"
      >
        <svg
          width="14"
          height="14"
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
        <span className="sr-only">History</span>
      </Link>
    </div>
  );
}
