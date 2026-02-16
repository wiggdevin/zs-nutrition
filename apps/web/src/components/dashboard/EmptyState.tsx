import Link from 'next/link';
import { DashboardHeader } from './DashboardHeader';
import { QuickActionsSection } from './QuickActionsSection';
import { ErrorBanner } from './ErrorBanner';

interface EmptyStateProps {
  calorieTarget: number;
  error: string | null;
  onDismissError: () => void;
}

export function EmptyState({ calorieTarget, error, onDismissError }: EmptyStateProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader calorieTarget={calorieTarget} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-8">
            <ErrorBanner error={error} onDismiss={onDismissError} />
          </div>
        )}

        {/* Empty State Container */}
        <div
          data-testid="empty-state-no-plans"
          className="flex flex-col items-center justify-center text-center py-20 px-4"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-8">
            <span className="text-5xl">🍽️</span>
          </div>

          <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted-foreground mb-3">
            /// GET STARTED
          </p>
          <h2 className="text-3xl md:text-4xl font-heading uppercase tracking-tight text-foreground mb-4">
            NO MEAL PLANS YET<span className="text-primary">.</span>
          </h2>

          <p className="text-muted-foreground text-base max-w-md mb-8 leading-relaxed">
            Generate your first personalized 7-day meal plan tailored to your goals, preferences,
            and macros.
          </p>

          <Link
            href="/generate"
            data-testid="generate-first-plan-cta"
            className="inline-flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary/90 text-background text-sm font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02]"
          >
            <span>⚡</span>
            Generate Your First Plan
            <span>→</span>
          </Link>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <span className="text-2xl mb-2">🎯</span>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                Set Goals
              </p>
            </div>
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <span className="text-2xl mb-2">📊</span>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                Track Macros
              </p>
            </div>
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <span className="text-2xl mb-2">🛒</span>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                Grocery Lists
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            Your AI-powered nutrition protocol starts here
          </p>
        </div>

        {/* Today's Log (Empty State) */}
        <section
          data-testid="todays-log-section"
          className="bg-card border border-border rounded-2xl p-6 mt-8 max-w-2xl mx-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
              /// Today&apos;s Log
            </p>
            <span className="text-xs text-muted-foreground">0 items logged</span>
          </div>
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
              <Link
                href="/tracking"
                data-testid="log-first-meal-btn"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 text-background rounded-xl transition-colors"
              >
                <span>🔥</span> Log Your First Meal
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <div className="mt-4 max-w-2xl mx-auto">
          <QuickActionsSection />
        </div>
      </main>
    </div>
  );
}
