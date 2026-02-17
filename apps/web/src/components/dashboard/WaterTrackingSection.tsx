'use client';

import { trpc } from '@/lib/trpc';
import { useWaterStore } from '@/lib/stores/useWaterStore';

function CircularProgress({
  current,
  goal,
  size = 140,
}: {
  current: number;
  goal: number;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / goal, 1);
  const offset = circumference - progress * circumference;
  const percentage = Math.round(progress * 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-info, hsl(210 100% 60%))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black font-mono">{percentage}%</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {current} / {goal} ml
        </span>
      </div>
    </div>
  );
}

export function WaterTrackingSection() {
  const { dailyGoalMl } = useWaterStore();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.tracking.getWaterLog.useQuery(undefined, {
    staleTime: 30_000,
  });

  const logWater = trpc.tracking.logWater.useMutation({
    onSuccess: () => {
      utils.tracking.getWaterLog.invalidate();
    },
  });

  const quickAmounts = [250, 500, 750];
  const totalMl = data?.totalMl ?? 0;

  return (
    <section
      data-testid="water-tracking-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-4">
        {'/// Water Intake'}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <CircularProgress current={totalMl} goal={dailyGoalMl} />

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((ml) => (
              <button
                key={ml}
                onClick={() => logWater.mutate({ amountMl: ml })}
                disabled={logWater.isPending}
                className="px-4 py-2 text-sm font-mono font-bold uppercase tracking-wider rounded-xl bg-background border border-border hover:border-[hsl(210,100%,60%)] hover:text-[hsl(210,100%,60%)] transition-colors disabled:opacity-50"
              >
                +{ml}ml
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading entries...</p>
          ) : data?.entries && data.entries.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Today&apos;s Entries
              </p>
              {data.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="font-mono">{entry.amountMl}ml</span>
                  <span className="font-mono">
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No water logged today</p>
          )}
        </div>
      </div>
    </section>
  );
}
