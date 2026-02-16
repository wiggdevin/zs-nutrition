'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * Cache key for storing weekly check results in sessionStorage.
 * This prevents repeated API calls during the same session.
 */
const WEEKLY_CHECK_CACHE_KEY = 'adaptive_nutrition_weekly_check';
const WEEKLY_CHECK_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CachedWeeklyCheckResult {
  timestamp: number;
  status: 'adjustment_suggested' | 'no_adjustment_needed' | 'insufficient_data' | 'error';
  suggestedGoalKcal?: number;
  currentGoalKcal?: number;
  calorieDifference?: number;
  reason?: string;
}

/**
 * Retrieves cached weekly check result from sessionStorage if still valid.
 */
function getCachedResult(): CachedWeeklyCheckResult | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = sessionStorage.getItem(WEEKLY_CHECK_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedWeeklyCheckResult;
    const isExpired = Date.now() - parsed.timestamp > WEEKLY_CHECK_CACHE_DURATION_MS;

    return isExpired ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Stores weekly check result in sessionStorage.
 */
function setCachedResult(result: Omit<CachedWeeklyCheckResult, 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheEntry: CachedWeeklyCheckResult = {
      ...result,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(WEEKLY_CHECK_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // Silently fail if sessionStorage is unavailable
  }
}

/**
 * AdaptiveNutritionBanner displays a notification on the dashboard when a calorie
 * adjustment is suggested based on the user's weight trend analysis.
 *
 * The component uses session caching to avoid repeated API calls and only shows
 * when the `runWeeklyCheck` procedure returns `status === 'adjustment_suggested'`.
 *
 * Design follows the existing dashboard styling with info-style blue coloring
 * for suggestions, keeping the notification helpful but non-intrusive.
 */
export function AdaptiveNutritionBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [cachedResult, setCachedResultState] = useState<CachedWeeklyCheckResult | null>(null);
  const [hasCheckedCache, setHasCheckedCache] = useState(false);
  const hasMutatedRef = useRef(false);

  // Check cache on mount
  useEffect(() => {
    const cached = getCachedResult();
    setCachedResultState(cached);
    setHasCheckedCache(true);
  }, []);

  // Run the weekly check mutation only if we don't have a cached result
  const weeklyCheckMutation = trpc.adaptiveNutrition.runWeeklyCheck.useMutation({
    onSuccess: (data) => {
      const result: Omit<CachedWeeklyCheckResult, 'timestamp'> = {
        status: data.status,
      };

      if (data.status === 'adjustment_suggested' && data.suggestion) {
        result.suggestedGoalKcal = data.suggestion.suggestedGoalKcal;
        result.currentGoalKcal = data.suggestion.currentGoalKcal;
        result.calorieDifference = data.suggestion.calorieDifference;
        result.reason = data.suggestion.reason;
      }

      setCachedResult(result);
      setCachedResultState({ ...result, timestamp: Date.now() });
    },
    onError: () => {
      // Cache the error state to avoid repeated failed calls
      const errorResult: Omit<CachedWeeklyCheckResult, 'timestamp'> = {
        status: 'error',
      };
      setCachedResult(errorResult);
      setCachedResultState({ ...errorResult, timestamp: Date.now() });
    },
  });

  // Trigger the mutation once on mount if no cached result exists
  useEffect(() => {
    if (hasCheckedCache && !cachedResult && !hasMutatedRef.current) {
      hasMutatedRef.current = true;
      weeklyCheckMutation.mutate();
    }
  }, [hasCheckedCache, cachedResult, weeklyCheckMutation]);

  // Determine what to display based on cached result or mutation state
  const displayResult = cachedResult;

  // Don't render anything if:
  // - User dismissed the banner
  // - Still loading/checking
  // - No adjustment is suggested
  // - Error occurred
  if (dismissed) return null;
  if (!displayResult) return null;
  if (displayResult.status !== 'adjustment_suggested') return null;

  const isIncrease = (displayResult.calorieDifference ?? 0) > 0;
  const absDifference = Math.abs(displayResult.calorieDifference ?? 0);

  return (
    <div
      data-testid="adaptive-nutrition-banner"
      role="alert"
      aria-live="polite"
      className={cn('relative rounded-2xl border p-5', 'bg-blue-500/10 border-blue-500/30')}
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-colors"
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

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          {isIncrease ? (
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono tracking-wider uppercase text-blue-400 mb-1">
            /// Adaptive Nutrition
          </p>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Calorie Adjustment Suggested
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Based on your recent weight trend, we recommend{' '}
            <span className={cn('font-semibold', isIncrease ? 'text-blue-400' : 'text-primary')}>
              {isIncrease ? 'increasing' : 'decreasing'}
            </span>{' '}
            your daily target by{' '}
            <span className="font-semibold text-foreground">{absDifference} kcal</span>
            {displayResult.currentGoalKcal && displayResult.suggestedGoalKcal && (
              <span className="text-muted-foreground">
                {' '}
                ({displayResult.currentGoalKcal} → {displayResult.suggestedGoalKcal} kcal/day)
              </span>
            )}
          </p>

          {/* Action link */}
          <Link
            href="/adaptive-nutrition"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
          >
            Review & Accept
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
