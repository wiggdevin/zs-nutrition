'use client';

import { trpc } from '@/lib/trpc';
import { ReadinessGauge } from './ReadinessGauge';
import { SleepStagesChart } from './SleepStagesChart';
import { HrvTrendChart } from './HrvTrendChart';

export function OuraInsightsPanel() {
  const { data: insights, isLoading } = trpc.fitness.getOuraInsights.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: sleepStages } = trpc.fitness.getSleepStages.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Don't render if no Oura connection or no data
  if (isLoading) return null;
  if (!insights) return null;

  const syncDateStr = insights.syncDate
    ? new Date(insights.syncDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Oura Ring Insights</h2>
        {syncDateStr && (
          <span className="text-xs text-muted-foreground">Last sync: {syncDateStr}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Readiness */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
            Readiness
          </h3>
          <ReadinessGauge
            score={insights.readinessScore}
            temperature={insights.readinessTemperature}
            hrvBalance={insights.readinessHrvBalance}
          />
        </div>

        {/* Sleep Stages */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
            Sleep Stages
          </h3>
          <SleepStagesChart
            deep={sleepStages?.deep ?? null}
            rem={sleepStages?.rem ?? null}
            light={sleepStages?.light ?? null}
            awake={sleepStages?.awake ?? null}
            totalMinutes={sleepStages?.totalMinutes ?? null}
            score={sleepStages?.score ?? null}
          />
        </div>
      </div>

      {/* HRV Trend - full width */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
          HRV Trend
        </h3>
        <HrvTrendChart />
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Biometric insights are for informational purposes only. Not medical advice.
      </p>
    </div>
  );
}
