'use client';

import Link from 'next/link';

interface PlanStaleBannerProps {
  staleReason: 'plan_age' | 'profile_changed' | null;
}

const MESSAGES: Record<string, string> = {
  plan_age: 'Your meal plan is over 7 days old. Generate a fresh plan for optimal results.',
  profile_changed:
    'Your profile has been updated since your last plan. Generate a new plan to reflect your changes.',
};

export function PlanStaleBanner({ staleReason }: PlanStaleBannerProps) {
  if (!staleReason) return null;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-800 dark:text-amber-300">{MESSAGES[staleReason]}</p>
      <Link
        href="/generate"
        className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors"
      >
        Generate New Plan
      </Link>
    </div>
  );
}
