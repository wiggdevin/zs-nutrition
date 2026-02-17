'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/20 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

export function MonthlyAdherenceSection() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = trpc.tracking.getMonthlyTrend.useQuery(
    { month, year },
    { staleTime: 60_000 }
  );

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    if (isCurrentMonth) return;
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Build calendar grid
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Index daily scores by day number
  const scoresByDay: Record<number, number> = {};
  if (data?.dailyScores) {
    for (const s of data.dailyScores) {
      const d = new Date(s.date).getUTCDate();
      scoresByDay[d] = s.adherenceScore;
    }
  }

  // Build grid cells: leading empty cells + day cells
  const cells: Array<{ day: number | null; score: number | null }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, score: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, score: scoresByDay[d] ?? null });
  }

  return (
    <section
      data-testid="monthly-adherence-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-4">
        {'/// Monthly Adherence'}
      </p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-1 rounded-lg hover:bg-background transition-colors"
          aria-label="Previous month"
        >
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="text-sm font-bold font-mono uppercase tracking-wider">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-1 rounded-lg hover:bg-background transition-colors disabled:opacity-30"
          aria-label="Next month"
        >
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Calendar heatmap */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground pb-1"
              >
                {label}
              </div>
            ))}
            {cells.map((cell, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {cell.day !== null ? (
                  <div
                    className={`w-full h-full max-w-8 max-h-8 rounded-md flex items-center justify-center text-[11px] font-mono border ${
                      cell.score !== null
                        ? getScoreBg(cell.score)
                        : 'bg-background/50 border-border/50'
                    }`}
                    title={
                      cell.score !== null
                        ? `Day ${cell.day}: ${cell.score}% adherence`
                        : `Day ${cell.day}: No data`
                    }
                  >
                    {cell.day}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mb-4 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/30" />
              <span>&gt;=80</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-yellow-500/20 border border-yellow-500/30" />
              <span>60-79</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
              <span>&lt;60</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-background/50 border border-border/50" />
              <span>No data</span>
            </div>
          </div>

          {/* Monthly stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <span className="text-xl font-black font-mono text-foreground">
                {data?.avgAdherence ?? 0}%
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                Avg Adherence
              </p>
            </div>
            <div className="text-center">
              <span className="text-xl font-black font-mono text-foreground">
                {data?.daysTracked ?? 0}
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                Days Tracked
              </p>
            </div>
            <div className="text-center">
              <span className="text-xl font-black font-mono text-foreground">
                {data?.bestStreak ?? 0}
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                Best Streak
              </p>
            </div>
            <div className="text-center">
              <span className="text-xl font-black font-mono text-foreground">
                {data?.avgKcal ?? 0}
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                Avg Kcal
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
