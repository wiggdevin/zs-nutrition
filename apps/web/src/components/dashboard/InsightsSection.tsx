'use client';

import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { InsightCard } from './InsightCard';
import type { InsightItem } from '@/lib/insights/schemas';

const SESSION_CACHE_KEY = 'zsn-insights-cache';
const SESSION_DISMISSED_KEY = 'zsn-insights-dismissed';
const SESSION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedInsights {
  insights: InsightItem[];
  generatedAt: string;
  timestamp: number;
}

function getSessionCache(): CachedInsights | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedInsights = JSON.parse(raw);
    if (Date.now() - cached.timestamp > SESSION_CACHE_TTL) {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setSessionCache(insights: InsightItem[], generatedAt: string) {
  try {
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ insights, generatedAt, timestamp: Date.now() })
    );
  } catch {
    // Session storage full or unavailable
  }
}

function getDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addDismissedId(id: string) {
  try {
    const dismissed = getDismissedIds();
    dismissed.add(id);
    sessionStorage.setItem(SESSION_DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Session storage full or unavailable
  }
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3" data-testid="insights-skeleton">
      {[0, 1].map((i) => (
        <div key={i} className="bg-muted/30 border border-border rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsightsSection() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedIds(getDismissedIds());
  }, []);

  const sessionCache = typeof window !== 'undefined' ? getSessionCache() : null;

  const { data, isLoading, error } = trpc.insights.getInsights.useQuery(undefined, {
    staleTime: SESSION_CACHE_TTL,
    enabled: !sessionCache,
  });

  const refreshMutation = trpc.insights.refreshInsights.useMutation({
    onSuccess: (result) => {
      setSessionCache(result.insights, result.generatedAt);
      setDismissedIds(new Set());
      try {
        sessionStorage.removeItem(SESSION_DISMISSED_KEY);
      } catch {
        // ignore
      }
    },
  });

  const insights = sessionCache?.insights ?? data?.insights ?? [];
  const insufficientData = !sessionCache && data?.insufficientData;
  const daysTracked = data?.daysTracked ?? 0;

  // Cache successful responses in session storage
  useEffect(() => {
    if (data?.insights && data.insights.length > 0 && !sessionCache) {
      setSessionCache(data.insights, data.generatedAt);
    }
  }, [data, sessionCache]);

  const handleDismiss = useCallback((id: string) => {
    addDismissedId(id);
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleRefresh = useCallback(() => {
    refreshMutation.mutate();
  }, [refreshMutation]);

  const visibleInsights = insights.filter((i) => !dismissedIds.has(i.id));

  if (error && !sessionCache) {
    return null; // Silently fail — insights are supplementary
  }

  if (isLoading && !sessionCache) {
    return (
      <section
        className="bg-card border border-border rounded-2xl p-6"
        data-testid="insights-section"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-4">
          {'/// AI Insights'}
        </p>
        <InsightsSkeleton />
      </section>
    );
  }

  if (insufficientData) {
    return (
      <section
        className="bg-card border border-border rounded-2xl p-6"
        data-testid="insights-section"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-4">
          {'/// AI Insights'}
        </p>
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Track at least 3 days of meals to unlock AI insights.
          </p>
          <p className="text-xs font-mono text-muted-foreground/60">{daysTracked}/3 days tracked</p>
        </div>
      </section>
    );
  }

  if (visibleInsights.length === 0 && insights.length === 0) {
    return null; // No insights to show
  }

  return (
    <section
      className="bg-card border border-border rounded-2xl p-6"
      data-testid="insights-section"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          {'/// AI Insights'}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          data-testid="refresh-insights-btn"
        >
          {refreshMutation.isPending ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Refreshing...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </span>
          )}
        </button>
      </div>

      {refreshMutation.error && (
        <p className="text-xs text-destructive mb-3">{refreshMutation.error.message}</p>
      )}

      {visibleInsights.length > 0 ? (
        <div className="space-y-3">
          {visibleInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          All insights dismissed. Click refresh for new ones.
        </p>
      )}
    </section>
  );
}
