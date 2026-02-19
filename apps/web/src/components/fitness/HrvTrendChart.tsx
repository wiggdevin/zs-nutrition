'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
] as const;

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HrvTrendChart() {
  const [days, setDays] = useState(14);
  const { data, isLoading } = trpc.fitness.getHrvTrend.useQuery(
    { days },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return <div className="h-48 animate-pulse bg-muted/30 rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Not enough HRV data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    hrv: d.hrv !== null ? Math.round(d.hrv) : null,
    restingHR: d.restingHR !== null ? Math.round(d.restingHR) : null,
  }));

  return (
    <div>
      {/* Range selector */}
      <div className="flex gap-1 mb-3">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDays(opt.days)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md transition-colors',
              days === opt.days
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="hrv"
            name="HRV (ms)"
            stroke="#a855f7"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="restingHR"
            name="Resting HR"
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
