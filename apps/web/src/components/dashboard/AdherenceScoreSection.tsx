interface AdherenceScoreSectionProps {
  adherenceScore: number;
  weeklyAverageAdherence: number | null;
}

export function AdherenceScoreSection({
  adherenceScore,
  weeklyAverageAdherence,
}: AdherenceScoreSectionProps) {
  return (
    <section
      data-testid="adherence-score-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          /// Adherence Score
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
                style={{
                  color:
                    weeklyAverageAdherence >= 80
                      ? 'var(--color-success)'
                      : weeklyAverageAdherence >= 50
                        ? 'var(--color-warning)'
                        : 'var(--destructive)',
                }}
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
    </section>
  );
}
