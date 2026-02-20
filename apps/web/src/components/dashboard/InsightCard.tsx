'use client';

import Link from 'next/link';
import type { InsightItem } from '@/lib/insights/schemas';

const severityConfig = {
  info: {
    icon: (
      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 01-1-1v-4a1 1 0 112 0v4a1 1 0 01-1 1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
  warning: {
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
  action: {
    icon: (
      <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
          clipRule="evenodd"
        />
      </svg>
    ),
    border: 'border-primary/20',
    bg: 'bg-primary/5',
  },
} as const;

const ctaHrefMap: Record<string, string> = {
  adjust_macros: '/tracking',
  regenerate_plan: '/plan/new',
  log_weight: '/tracking?mode=weight',
  view_trends: '/dashboard#insights',
  swap_meals: '/plan',
  view_plan: '/plan',
};

interface InsightCardProps {
  insight: InsightItem;
  onDismiss: (id: string) => void;
}

export function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const config = severityConfig[insight.severity];
  const href = ctaHrefMap[insight.ctaType] || '/dashboard';

  return (
    <div
      data-testid={`insight-card-${insight.category}`}
      className={`relative ${config.bg} border ${config.border} rounded-xl p-4 transition-all`}
    >
      <button
        onClick={() => onDismiss(insight.id)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss insight"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="text-sm font-bold text-foreground leading-tight">{insight.title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {insight.supportingData.metric}: {insight.supportingData.actual} /{' '}
              {insight.supportingData.target}
              {insight.supportingData.trend && ` (${insight.supportingData.trend})`}
            </span>
          </div>

          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            {insight.ctaLabel}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
