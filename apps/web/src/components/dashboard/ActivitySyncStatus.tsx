'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * Platform display names and icons for activity sync sources.
 */
const PLATFORM_CONFIG: Record<string, { label: string; icon: string }> = {
  apple_health: { label: 'Apple Health', icon: '' },
  google_fit: { label: 'Google Fit', icon: '' },
  fitbit: { label: 'Fitbit', icon: '' },
  oura: { label: 'Oura', icon: '' },
};

/**
 * ActivitySyncStatus displays a compact indicator showing:
 * - Bonus calories applied today from activity syncs
 * - Number of unprocessed syncs (if any)
 * - Link to activity page for more details
 *
 * Only renders if the user has connected fitness platforms and has activity data.
 * Uses green/success coloring to indicate positive activity bonuses.
 */
export function ActivitySyncStatus() {
  const { data, isLoading, error } = trpc.adaptiveNutrition.getActivitySyncStatus.useQuery(
    undefined,
    {
      // Refetch every 5 minutes to pick up new activity syncs
      refetchInterval: 5 * 60 * 1000,
      // Stale time of 2 minutes - don't refetch if data is fresh
      staleTime: 2 * 60 * 1000,
    }
  );

  // Don't show anything while loading
  if (isLoading) return null;

  // Don't show anything if there's an error or no data
  if (error || !data) return null;

  // Don't show anything if user has no activity syncs today
  if (data.todaysSyncs.total === 0) return null;

  const hasBonusApplied = data.bonusApplied > 0;
  const hasUnprocessed = data.hasUnprocessed;
  const platformNames = data.platforms.map((p) => PLATFORM_CONFIG[p]?.label ?? p).filter(Boolean);

  return (
    <div
      data-testid="activity-sync-status"
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border',
        hasBonusApplied ? 'bg-success/10 border-success/30' : 'bg-card border-border'
      )}
    >
      {/* Activity icon */}
      <div
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          hasBonusApplied ? 'bg-success/20' : 'bg-muted'
        )}
      >
        <svg
          className={cn('w-4 h-4', hasBonusApplied ? 'text-success' : 'text-muted-foreground')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
            Activity Sync
          </span>
          {hasUnprocessed && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary"
              data-testid="unprocessed-badge"
            >
              {data.todaysSyncs.unprocessed} pending
            </span>
          )}
        </div>

        {hasBonusApplied ? (
          <p className="text-sm">
            <span className="font-semibold text-success">+{data.bonusApplied} kcal</span>
            <span className="text-muted-foreground"> bonus applied</span>
            {data.totalActiveCalories > 0 && (
              <span className="text-xs text-muted-foreground">
                {' '}
                ({data.totalActiveCalories} active kcal burned)
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.totalActiveCalories > 0 ? (
              <>
                {data.totalActiveCalories} active kcal logged
                <span className="text-xs"> (below bonus threshold)</span>
              </>
            ) : (
              'Activity synced, no calories recorded yet'
            )}
          </p>
        )}

        {platformNames.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            From: {platformNames.join(', ')}
          </p>
        )}
      </div>

      {/* Link to activity page */}
      <Link
        href="/activity"
        aria-label="View activity details"
        className={cn(
          'flex-shrink-0 p-2 rounded-lg transition-colors',
          hasBonusApplied
            ? 'text-success hover:bg-success/20'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
