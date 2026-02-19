'use client';

import { cn } from '@/lib/utils';

interface ReadinessGaugeProps {
  score: number | null;
  temperature?: number | null;
  hrvBalance?: number | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Optimal';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Low';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-green-400';
  if (score >= 60) return 'stroke-yellow-400';
  if (score >= 40) return 'stroke-orange-400';
  return 'stroke-red-400';
}

export function ReadinessGauge({ score, temperature, hrvBalance }: ReadinessGaugeProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No readiness data available
      </div>
    );
  }

  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div className="flex items-center gap-6">
      {/* Radial gauge */}
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-muted/30" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-all duration-700', getScoreRingColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold tabular-nums', getScoreColor(score))}>
            {score}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {getScoreLabel(score)}
          </span>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="space-y-2 text-sm">
        {temperature !== null && temperature !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Body Temp</span>
            <span
              className={cn('font-mono', temperature > 0.5 ? 'text-orange-400' : 'text-foreground')}
            >
              {temperature > 0 ? '+' : ''}
              {temperature.toFixed(1)}&deg;
            </span>
          </div>
        )}
        {hrvBalance !== null && hrvBalance !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">HRV Balance</span>
            <span className="font-mono">{hrvBalance}</span>
          </div>
        )}
      </div>
    </div>
  );
}
