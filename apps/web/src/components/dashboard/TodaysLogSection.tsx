import Link from 'next/link';
import { LogEntry } from './LogEntry';
import type { TrackedMealEntry } from '@/lib/stores/useTrackingStore';

interface TodaysLogSectionProps {
  trackedMeals: TrackedMealEntry[];
  todayPlanMealsCount: number;
  formatTime: (isoString: string) => string;
  onAdjustPortion: (trackedMealId: string, newPortion: number) => void;
  adjustingMealId: string | null;
}

export function TodaysLogSection({
  trackedMeals,
  todayPlanMealsCount,
  formatTime,
  onAdjustPortion,
  adjustingMealId,
}: TodaysLogSectionProps) {
  return (
    <section
      data-testid="todays-log-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          {"/// Today's Log"}
        </p>
        <span className="text-xs text-muted-foreground">
          {trackedMeals.length} item{trackedMeals.length !== 1 ? 's' : ''} logged
        </span>
      </div>
      {trackedMeals.length === 0 ? (
        <div data-testid="empty-log-state" className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl">🍽️</span>
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">No meals logged yet today</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start tracking to see your progress toward today&apos;s goals.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {todayPlanMealsCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Tap <span className="text-primary font-bold">&quot;Log&quot;</span> on a plan meal
                to get started!
              </p>
            ) : (
              <Link
                href="/tracking"
                data-testid="log-first-meal-btn"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 text-background rounded-xl transition-colors"
              >
                <span>🔥</span> Log Your First Meal
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {trackedMeals.map((entry) => (
            <LogEntry
              key={entry.id}
              id={entry.id}
              name={entry.name}
              calories={entry.calories}
              protein={Math.round(entry.protein)}
              carbs={entry.carbs}
              fat={entry.fat}
              portion={entry.portion || 1}
              source={entry.source}
              confidenceScore={entry.confidenceScore}
              time={formatTime(entry.createdAt)}
              onAdjust={onAdjustPortion}
              isAdjusting={adjustingMealId === entry.id}
            />
          ))}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          Log meals to see your progress update in real-time
        </p>
      </div>
    </section>
  );
}
