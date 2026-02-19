'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SleepStagesChartProps {
  deep: number | null;
  rem: number | null;
  light: number | null;
  awake: number | null;
  totalMinutes: number | null;
  score: number | null;
}

const STAGE_COLORS = {
  Deep: '#3b82f6',
  REM: '#a855f7',
  Light: '#06b6d4',
  Awake: '#ef4444',
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SleepStagesChart({
  deep,
  rem,
  light,
  awake,
  totalMinutes,
  score,
}: SleepStagesChartProps) {
  if (
    (deep === null || deep === undefined) &&
    (rem === null || rem === undefined) &&
    (light === null || light === undefined)
  ) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No sleep stage data available
      </div>
    );
  }

  const data = [
    { name: 'Deep', value: deep ?? 0 },
    { name: 'REM', value: rem ?? 0 },
    { name: 'Light', value: light ?? 0 },
    { name: 'Awake', value: awake ?? 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-6">
      {/* Donut chart */}
      <div className="relative w-28 h-28 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={50}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STAGE_COLORS[entry.name as keyof typeof STAGE_COLORS]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {totalMinutes !== null && totalMinutes !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-bold tabular-nums">{formatMinutes(totalMinutes)}</span>
            <span className="text-[9px] text-muted-foreground">total</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-1.5 text-sm">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: STAGE_COLORS[entry.name as keyof typeof STAGE_COLORS] }}
            />
            <span className="text-muted-foreground w-12">{entry.name}</span>
            <span className="font-mono tabular-nums">{formatMinutes(entry.value)}</span>
          </div>
        ))}
        {score !== null && score !== undefined && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <span className="text-muted-foreground w-[62px]">Score</span>
            <span className="font-mono tabular-nums font-medium">{score}</span>
          </div>
        )}
      </div>
    </div>
  );
}
