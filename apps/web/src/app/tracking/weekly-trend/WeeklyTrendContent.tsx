'use client'

import { trpc } from '@/lib/trpc'
import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Metric = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'

interface MetricConfig {
  label: string
  unit: string
  color: string
  dataKeyActual: string
  dataKeyTarget: string
}

const metricConfigs: Record<Metric, MetricConfig> = {
  kcal: {
    label: 'Calories',
    unit: 'kcal',
    color: '#f97316',
    dataKeyActual: 'actualKcal',
    dataKeyTarget: 'targetKcal',
  },
  proteinG: {
    label: 'Protein',
    unit: 'g',
    color: '#3b82f6',
    dataKeyActual: 'actualProteinG',
    dataKeyTarget: 'targetProteinG',
  },
  carbsG: {
    label: 'Carbs',
    unit: 'g',
    color: '#22c55e',
    dataKeyActual: 'actualCarbsG',
    dataKeyTarget: 'targetCarbsG',
  },
  fatG: {
    label: 'Fat',
    unit: 'g',
    color: '#eab308',
    dataKeyActual: 'actualFatG',
    dataKeyTarget: 'targetFatG',
  },
}

// Helper to format UTC date as M/D (e.g., "1/28") without timezone shift
function formatUTCDateShort(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

// Helper to format UTC date as locale date string without timezone shift
function formatUTCDateFull(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`
}

interface ChartDataPoint {
  label: string
  actualKcal: number
  targetKcal: number | null
  actualProteinG: number
  targetProteinG: number | null
  actualCarbsG: number
  targetCarbsG: number | null
  actualFatG: number
  targetFatG: number | null
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label, metric }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string; metric: Metric }) {
  if (!active || !payload || !payload.length) return null
  const config = metricConfigs[metric]
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {metric === 'kcal' ? Math.round(entry.value) : Math.round(entry.value * 10) / 10} {config.unit}
        </p>
      ))}
    </div>
  )
}

export default function WeeklyTrendContent() {
  // Calculate today's date at midnight for constraints
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [startDate, setStartDate] = useState(() => {
    // Default to 6 days ago for a 7-day range including today
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const [selectedMetric, setSelectedMetric] = useState<Metric>('kcal')

  const { data, isLoading, error, refetch } = trpc.tracking.getWeeklyTrend.useQuery({
    startDate,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-[#a1a1aa]">Loading weekly trend...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4" data-testid="network-error-state">
        <div className="flex flex-col items-center text-center space-y-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-400">Error: {error.message}</p>
          <button
            onClick={() => refetch()}
            data-testid="retry-button"
            className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] text-sm font-bold uppercase tracking-wide rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return <p className="text-[#a1a1aa]">No data returned.</p>
  }

  // Build chart data from API response
  const chartData: ChartDataPoint[] = data.days.map((day) => {
    const d = new Date(day.date)
    const dayName = dayNames[d.getUTCDay()] // Use getUTCDay() to avoid timezone shift
    const dateNum = formatUTCDateShort(day.date) // Use UTC formatting
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
    }
  })

  const metricConfig = metricConfigs[selectedMetric]

  return (
    <div data-testid="weekly-trend-container">
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label htmlFor="start-date-input" className="text-sm text-[#a1a1aa] mr-2">
            Start date:
          </label>
          <input
            id="start-date-input"
            type="date"
            value={startDate}
            max={todayStr}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#18181b] border border-[#27272a] rounded px-2 py-1 text-sm text-white"
            data-testid="start-date-input"
          />
        </div>

        <div>
          <label htmlFor="metric-selector" className="text-sm text-[#a1a1aa] mr-2">
            Metric:
          </label>
          <select
            id="metric-selector"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as Metric)}
            className="bg-[#18181b] border border-[#27272a] rounded px-2 py-1 text-sm text-white"
            data-testid="metric-selector"
          >
            <option value="kcal">Calories</option>
            <option value="proteinG">Protein</option>
            <option value="carbsG">Carbs</option>
            <option value="fatG">Fat</option>
          </select>
        </div>
      </div>

      <div className="mb-4 text-sm text-[#a1a1aa]">
        <span>Period: </span>
        <span data-testid="trend-start-date">{formatUTCDateFull(data.startDate)}</span>
        <span> - </span>
        <span data-testid="trend-end-date">{data.days.length > 0 ? formatUTCDateFull(data.days[data.days.length - 1].date) : formatUTCDateFull(data.endDate)}</span>
        <span className="ml-3">({data.totalDays} days)</span>
      </div>

      {/* ── Recharts Line Chart: Actual vs Target for selected metric ── */}
      <div
        data-testid="weekly-trend-chart"
        className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 mb-6"
      >
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          {metricConfig.label} — Actual vs Target
        </h2>
        <div data-testid="chart-responsive-wrapper" style={{ width: '100%', minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                stroke="#27272a"
              />
              <YAxis
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                stroke="#27272a"
                width={50}
                label={{ value: metricConfig.unit, angle: -90, position: 'insideLeft', fill: '#a1a1aa', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
              <Legend
                wrapperStyle={{ color: '#a1a1aa', fontSize: 13, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey={metricConfig.dataKeyTarget}
                name="Target"
                stroke={metricConfig.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: metricConfig.color, r: 4 }}
                connectNulls
                data-testid="target-line"
              />
              <Line
                type="monotone"
                dataKey={metricConfig.dataKeyActual}
                name="Actual"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ fill: '#22d3ee', r: 4 }}
                activeDot={{ r: 6 }}
                data-testid="actual-line"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Daily detail cards ── */}
      <div className="space-y-3" data-testid="weekly-days-list">
        {data.days.map((day, i) => {
          const d = new Date(day.date)
          const dayName = dayNames[d.getUTCDay()] // Use getUTCDay() to avoid timezone shift
          const dateStr = formatUTCDateFull(day.date) // Use UTC formatting

          return (
            <div
              key={day.date}
              data-testid={`day-summary-${i}`}
              className="bg-[#18181b] border border-[#27272a] rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{dayName}</span>
                  <span className="text-[#a1a1aa] text-sm">{dateStr}</span>
                </div>
                {day.adherenceScore !== null && (
                  <span
                    data-testid={`adherence-score-${i}`}
                    className={`text-sm font-medium px-2 py-0.5 rounded ${
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
                <span className="text-xs text-[#a1a1aa] uppercase tracking-wider">Targets:</span>
                {day.targets ? (
                  <div className="flex gap-3 mt-1" data-testid={`day-targets-${i}`}>
                    <span className="text-orange-400 text-sm">{day.targets.kcal ?? '-'} kcal</span>
                    <span className="text-blue-400 text-sm">P {day.targets.proteinG ?? '-'}g</span>
                    <span className="text-green-400 text-sm">C {day.targets.carbsG ?? '-'}g</span>
                    <span className="text-yellow-400 text-sm">F {day.targets.fatG ?? '-'}g</span>
                  </div>
                ) : (
                  <span className="text-[#a1a1aa] text-sm ml-2">No targets set</span>
                )}
              </div>

              {/* Actuals */}
              <div>
                <span className="text-xs text-[#a1a1aa] uppercase tracking-wider">Actuals:</span>
                <div className="flex gap-3 mt-1" data-testid={`day-actuals-${i}`}>
                  <span className="text-orange-400 text-sm">{day.actuals.kcal} kcal</span>
                  <span className="text-blue-400 text-sm">P {day.actuals.proteinG}g</span>
                  <span className="text-green-400 text-sm">C {day.actuals.carbsG}g</span>
                  <span className="text-yellow-400 text-sm">F {day.actuals.fatG}g</span>
                </div>
              </div>

              <div className="mt-1 text-xs text-[#a1a1aa]">{day.mealCount} meals logged</div>
            </div>
          )
        })}
      </div>

      {/* Raw JSON for testing */}
      <details className="mt-6">
        <summary className="text-[#a1a1aa] text-sm cursor-pointer">Raw API Response</summary>
        <pre
          data-testid="raw-api-response"
          className="mt-2 bg-[#18181b] border border-[#27272a] rounded-lg p-4 text-xs text-[#a1a1aa] overflow-auto max-h-96"
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}
