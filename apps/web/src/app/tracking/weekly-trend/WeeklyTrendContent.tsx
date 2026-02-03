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

interface ChartDataPoint {
  label: string
  actualKcal: number
  targetKcal: number | null
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value)} kcal
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
    const dayName = dayNames[d.getDay()]
    const dateNum = `${d.getMonth() + 1}/${d.getDate()}`
    return {
      label: `${dayName} ${dateNum}`,
      actualKcal: day.actuals.kcal,
      targetKcal: day.targets?.kcal ?? null,
    }
  })

  return (
    <div data-testid="weekly-trend-container">
      <div className="mb-4">
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

      <div className="mb-4 text-sm text-[#a1a1aa]">
        <span>Period: </span>
        <span data-testid="trend-start-date">{new Date(data.startDate).toLocaleDateString()}</span>
        <span> - </span>
        <span data-testid="trend-end-date">{data.days.length > 0 ? new Date(data.days[data.days.length - 1].date).toLocaleDateString() : new Date(data.endDate).toLocaleDateString()}</span>
        <span className="ml-3">({data.totalDays} days)</span>
      </div>

      {/* ── Recharts Line Chart: Actual vs Target kcal ── */}
      <div
        data-testid="weekly-trend-chart"
        className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 mb-6"
      >
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Calories — Actual vs Target
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
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ color: '#a1a1aa', fontSize: 13, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="targetKcal"
                name="Target"
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: '#f97316', r: 4 }}
                connectNulls
                data-testid="target-line"
              />
              <Line
                type="monotone"
                dataKey="actualKcal"
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
          const dayName = dayNames[d.getDay()]
          const dateStr = d.toLocaleDateString()

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
