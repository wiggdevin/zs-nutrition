interface AdherenceScoreSectionProps {
  adherenceScore: number;
  weeklyAverageAdherence: number | null;
  dailyScores?: number[];
  macroAdherence?: { protein: number; carbs: number; fat: number };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--destructive)';
}

function MiniSparkline({ scores }: { scores: number[] }) {
  const width = 120;
  const height = 40;
  const padX = 6;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = scores.map((score, i) => {
    const x = padX + (i / Math.max(scores.length - 1, 1)) * innerW;
    const y = padY + innerH - (score / 100) * innerH;
    return { x, y, score };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={width} height={height} className="block" aria-label="7-day adherence sparkline">
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--color-success)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.6}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill="var(--background)"
          stroke={getScoreColor(p.score)}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

function MacroBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-10">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export function AdherenceScoreSection({
  adherenceScore,
  weeklyAverageAdherence,
  dailyScores,
  macroAdherence,
}: AdherenceScoreSectionProps) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const bestDay =
    dailyScores && dailyScores.length > 0
      ? dailyScores.reduce((best, s, i) => (s > dailyScores[best] ? i : best), 0)
      : null;
  const worstDay =
    dailyScores && dailyScores.length > 0
      ? dailyScores.reduce((worst, s, i) => (s < dailyScores[worst] ? i : worst), 0)
      : null;

  return (
    <section
      data-testid="adherence-score-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          {'/// Adherence Score'}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center">
            <span
              data-testid="adherence-score-today"
              className="text-4xl sm:text-5xl font-black text-success font-mono"
            >
              {adherenceScore}
            </span>
            <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground mt-1">
              Today
            </span>
          </div>
          <div className="h-12 w-px bg-border" />
          {weeklyAverageAdherence !== null && weeklyAverageAdherence !== undefined ? (
            <div className="flex flex-col items-center">
              <span
                data-testid="adherence-score-weekly"
                className="text-2xl sm:text-3xl font-bold font-mono"
                style={{ color: getScoreColor(weeklyAverageAdherence) }}
              >
                {weeklyAverageAdherence}
              </span>
              <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground mt-1">
                7-Day Avg
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-muted-foreground">
                —
              </span>
              <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground mt-1">
                7-Day Avg
              </span>
            </div>
          )}
        </div>
        <div className="hidden sm:block h-12 w-px bg-border" />
        <div className="w-full sm:flex-1">
          <div
            className="h-3 bg-border rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Daily adherence score"
            aria-valuenow={adherenceScore}
            aria-valuemax={100}
            aria-valuetext={`${adherenceScore}% daily adherence`}
          >
            <div
              className="h-full bg-gradient-to-r from-success to-success/70 rounded-full transition-all duration-700"
              style={{ width: `${adherenceScore}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">0 — 100 daily score</p>
        </div>
      </div>

      {/* 7-day sparkline + macro breakdown */}
      {(dailyScores || macroAdherence) && (
        <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row gap-5">
          {dailyScores && dailyScores.length > 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                7-Day Trend
              </p>
              <MiniSparkline scores={dailyScores} />
              {bestDay !== null && worstDay !== null && (
                <p className="text-[10px] text-muted-foreground">
                  Best: <span className="text-success font-medium">{dayLabels[bestDay % 7]}</span>
                  {' · '}
                  Worst:{' '}
                  <span className="text-destructive font-medium">{dayLabels[worstDay % 7]}</span>
                </p>
              )}
            </div>
          )}

          {macroAdherence && (
            <div className="flex-1 flex flex-col gap-2 min-w-[140px]">
              <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                Macro Adherence
              </p>
              <div className="flex flex-col gap-1.5">
                <MacroBar label="PRO" value={macroAdherence.protein} color="var(--color-success)" />
                <MacroBar label="CARB" value={macroAdherence.carbs} color="var(--color-warning)" />
                <MacroBar
                  label="FAT"
                  value={macroAdherence.fat}
                  color="var(--color-info, hsl(210 100% 60%))"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
