'use client';

import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Metric = 'kcal' | 'proteinG' | 'carbsG' | 'fatG';

interface MetricConfig {
  label: string;
  unit: string;
  color: string;
  dataKeyActual: string;
  dataKeyTarget: string;
}

const metricConfigs: Record<Metric, MetricConfig> = {
  kcal: {
    label: 'Calories',
    unit: 'kcal',
    color: 'var(--primary)',
    dataKeyActual: 'actualKcal',
    dataKeyTarget: 'targetKcal',
  },
  proteinG: {
    label: 'Protein',
    unit: 'g',
    color: 'var(--chart-3)',
    dataKeyActual: 'actualProteinG',
    dataKeyTarget: 'targetProteinG',
  },
  carbsG: {
    label: 'Carbs',
    unit: 'g',
    color: 'var(--color-success)',
    dataKeyActual: 'actualCarbsG',
    dataKeyTarget: 'targetCarbsG',
  },
  fatG: {
    label: 'Fat',
    unit: 'g',
    color: 'var(--color-warning)',
    dataKeyActual: 'actualFatG',
    dataKeyTarget: 'targetFatG',
  },
};

// Helper to format UTC date as M/D (e.g., "1/28") without timezone shift
function formatUTCDateShort(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// Helper to format UTC date as locale date string without timezone shift
function formatUTCDateFull(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

interface ChartDataPoint {
  label: string;
  actualKcal: number;
  targetKcal: number | null;
  actualProteinG: number;
  targetProteinG: number | null;
  actualCarbsG: number;
  targetCarbsG: number | null;
  actualFatG: number;
  targetFatG: number | null;
}

// Custom tooltip for the chart
function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  metric: Metric;
}) {
  if (!active || !payload || !payload.length) return null;
  const config = metricConfigs[metric];
  return (
    <div className="bg-card border border-secondary rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}:{' '}
          {metric === 'kcal' ? Math.round(entry.value) : Math.round(entry.value * 10) / 10}{' '}
          {config.unit}
        </p>
      ))}
    </div>
  );
}

export default function WeeklyTrendContent() {
  // Calculate today's date at midnight for constraints
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(() => {
    // Default to 6 days ago for a 7-day range including today
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [selectedMetric, setSelectedMetric] = useState<Metric>('kcal');

  const { data, isLoading, error, refetch } = trpc.tracking.getWeeklyTrend.useQuery({
    startDate,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-muted-foreground">Loading weekly trend...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-red-900/30 border border-red-700 rounded-lg p-4"
        data-testid="network-error-state"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-400">Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            data-testid="retry-button"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-background text-sm font-bold uppercase tracking-wide rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">No data returned.</p>;
  }

  // Build chart data from API response
  const chartData: ChartDataPoint[] = data.days.map((day) => {
    const d = new Date(day.date);
    const dayName = dayNames[d.getUTCDay()]; // Use getUTCDay() to avoid timezone shift
    const dateNum = formatUTCDateShort(day.date); // Use UTC formatting
    return {
      label: `${dayName} ${dateNum}`,
      actualKcal: day.actuals.kcal,
      targetKcal: day.targets?.kcal ?? null,
      actualProteinG: day.actuals.proteinG,
      targetProteinG: day.targets?.proteinG ?? null,
      actualCarbsG: day.actuals.carbsG,
      targetCarbsG: day.targets?.carbsG ?? null,
      actualFatG: day.actuals.fatG,
      targetFatG: day.targets?.fatG ?? null,
    };
  });

  const metricConfig = metricConfigs[selectedMetric];

  // Calculate weekly adherence average (mean of daily scores)
  const daysWithScores = data.days.filter((d) => d.adherenceScore !== null);
  const weeklyAverage =
    daysWithScores.length > 0
      ? Math.round(
          daysWithScores.reduce((sum, d) => sum + (d.adherenceScore ?? 0), 0) /
            daysWithScores.length
        )
      : null;

  return (
    <div data-testid="weekly-trend-container">
      {/* ── Weekly Average Display ── */}
      {weeklyAverage !== null && (
        <div
          className="mb-4 md:mb-6 bg-card border border-secondary rounded-lg p-4 md:p-6"
          data-testid="weekly-average-display"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider mb-1">
                Weekly Average
              </h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Based on {daysWithScores.length} day{daysWithScores.length !== 1 ? 's' : ''} of data
              </p>
            </div>
            <div className="text-right">
              <div
                className={`text-2xl md:text-4xl font-bold ${
                  weeklyAverage >= 80
                    ? 'text-green-400'
                    : weeklyAverage >= 50
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
                data-testid="weekly-average-score"
              >
                {weeklyAverage}%
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">adherence</div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center">
          <label
            htmlFor="start-date-input"
            className="text-xs sm:text-sm text-muted-foreground sm:mr-2 mb-1 sm:mb-0"
          >
            Start date:
          </label>
          <input
            id="start-date-input"
            type="date"
            value={startDate}
            max={todayStr}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-card border border-secondary rounded px-2 py-1 text-xs sm:text-sm text-white w-full sm:w-auto"
            data-testid="start-date-input"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center">
          <label
            htmlFor="metric-selector"
            className="text-xs sm:text-sm text-muted-foreground sm:mr-2 mb-1 sm:mb-0"
          >
            Metric:
          </label>
          <select
            id="metric-selector"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as Metric)}
            className="bg-card border border-secondary rounded px-2 py-1 text-xs sm:text-sm text-white w-full sm:w-auto"
            data-testid="metric-selector"
          >
            <option value="kcal">Calories</option>
            <option value="proteinG">Protein</option>
            <option value="carbsG">Carbs</option>
            <option value="fatG">Fat</option>
          </select>
        </div>
      </div>

      <div className="mb-4 text-xs sm:text-sm text-muted-foreground">
        <span>Period: </span>
        <span data-testid="trend-start-date">{formatUTCDateFull(data.startDate)}</span>
        <span> - </span>
        <span data-testid="trend-end-date">
          {data.days.length > 0
            ? formatUTCDateFull(data.days[data.days.length - 1].date)
            : formatUTCDateFull(data.endDate)}
        </span>
        <span className="ml-2 sm:ml-3">({data.totalDays} days)</span>
      </div>

      {/* ── Recharts Line Chart: Actual vs Target for selected metric ── */}
      <div
        data-testid="weekly-trend-chart"
        className="bg-card border border-secondary rounded-lg p-3 md:p-4 mb-6"
      >
        <h2 className="text-white font-semibold text-xs md:text-sm uppercase tracking-wider mb-3 md:mb-4">
          {metricConfig.label} — Actual vs Target
        </h2>
        <div data-testid="chart-responsive-wrapper" style={{ width: '100%', minHeight: 250 }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                stroke="var(--secondary)"
                interval={0}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                stroke="var(--secondary)"
                width={40}
                label={{
                  value: metricConfig.unit,
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'var(--muted-foreground)',
                  fontSize: 10,
                }}
              />
              <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
              <Legend
                wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: '11px', paddingTop: 4 }}
              />
              <Line
                type="monotone"
                dataKey={metricConfig.dataKeyTarget}
                name="Target"
                stroke={metricConfig.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: metricConfig.color, r: 3 }}
                connectNulls
                data-testid="target-line"
              />
              <Line
                type="monotone"
                dataKey={metricConfig.dataKeyActual}
                name="Actual"
                stroke="var(--chart-5)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-5)', r: 3 }}
                activeDot={{ r: 5 }}
                data-testid="actual-line"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Daily detail cards ── */}
      <div className="space-y-3" data-testid="weekly-days-list">
        {data.days.map((day, i) => {
          const d = new Date(day.date);
          const dayName = dayNames[d.getUTCDay()]; // Use getUTCDay() to avoid timezone shift
          const dateStr = formatUTCDateFull(day.date); // Use UTC formatting

          return (
            <div
              key={day.date}
              data-testid={`day-summary-${i}`}
              className="bg-card border border-secondary rounded-lg p-3 md:p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-white font-semibold text-sm md:text-base">{dayName}</span>
                  <span className="text-muted-foreground text-xs md:text-sm">{dateStr}</span>
                </div>
                {day.adherenceScore !== null && (
                  <span
                    data-testid={`adherence-score-${i}`}
                    className={`text-xs md:text-sm font-medium px-2 py-0.5 rounded ${
                      day.adherenceScore >= 80
                        ? 'bg-green-900/50 text-green-400'
                        : day.adherenceScore >= 50
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                    }`}
                  >
                    {day.adherenceScore}% adherence
                  </span>
                )}
              </div>

              {/* Targets */}
              <div className="mb-1">
                <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                  Targets:
                </span>
                {day.targets ? (
                  <div
                    className="flex gap-2 md:gap-3 mt-1 flex-wrap"
                    data-testid={`day-targets-${i}`}
                  >
                    <span className="text-primary text-xs md:text-sm">
                      {day.targets.kcal ?? '-'} kcal
                    </span>
                    <span className="text-blue-400 text-xs md:text-sm">
                      P {day.targets.proteinG ?? '-'}g
                    </span>
                    <span className="text-green-400 text-xs md:text-sm">
                      C {day.targets.carbsG ?? '-'}g
                    </span>
                    <span className="text-yellow-400 text-xs md:text-sm">
                      F {day.targets.fatG ?? '-'}g
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs md:text-sm ml-2">
                    No targets set
                  </span>
                )}
              </div>

              {/* Actuals */}
              <div>
                <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                  Actuals:
                </span>
                <div
                  className="flex gap-2 md:gap-3 mt-1 flex-wrap"
                  data-testid={`day-actuals-${i}`}
                >
                  <span className="text-primary text-xs md:text-sm">{day.actuals.kcal} kcal</span>
                  <span className="text-blue-400 text-xs md:text-sm">
                    P {day.actuals.proteinG}g
                  </span>
                  <span className="text-green-400 text-xs md:text-sm">C {day.actuals.carbsG}g</span>
                  <span className="text-yellow-400 text-xs md:text-sm">F {day.actuals.fatG}g</span>
                </div>
              </div>

              <div className="mt-1 text-[10px] md:text-xs text-muted-foreground">
                {day.mealCount} meals logged
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw JSON for testing */}
      <details className="mt-6">
        <summary className="text-muted-foreground text-sm cursor-pointer">Raw API Response</summary>
        <pre
          data-testid="raw-api-response"
          className="mt-2 bg-card border border-secondary rounded-lg p-4 text-xs text-muted-foreground overflow-auto max-h-96"
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
