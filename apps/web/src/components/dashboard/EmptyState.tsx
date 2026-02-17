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
          {/* SVG illustration */}
          <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-8">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-primary">
              <rect
                x="8"
                y="4"
                width="48"
                height="56"
                rx="8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect x="16" y="14" width="32" height="4" rx="2" fill="currentColor" opacity="0.3" />
              <rect
                x="16"
                y="24"
                width="24"
                height="3"
                rx="1.5"
                fill="currentColor"
                opacity="0.2"
              />
              <rect
                x="16"
                y="32"
                width="28"
                height="3"
                rx="1.5"
                fill="currentColor"
                opacity="0.2"
              />
              <rect
                x="16"
                y="40"
                width="20"
                height="3"
                rx="1.5"
                fill="currentColor"
                opacity="0.2"
              />
              <circle
                cx="44"
                cy="44"
                r="12"
                fill="currentColor"
                opacity="0.1"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M40 44l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted-foreground mb-3">
            {'/// GET STARTED'}
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
            style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
            </svg>
            Generate Your First Plan
            <span>&#8594;</span>
          </Link>

          {/* How it works */}
          <div className="mt-12 max-w-lg w-full mx-auto">
            <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground text-center mb-6">
              {'/// HOW IT WORKS'}
            </p>
            <div className="flex items-start gap-2 sm:gap-4">
              {[
                {
                  step: '1',
                  title: 'Set Your Goals',
                  desc: 'Tell us your targets, diet, and preferences',
                },
                {
                  step: '2',
                  title: 'AI Builds Your Plan',
                  desc: '6 agents craft your personalized meals',
                },
                {
                  step: '3',
                  title: 'Track & Crush It',
                  desc: 'Log meals, hit macros, see progress',
                },
              ].map((item, i) => (
                <div key={item.step} className="flex-1 flex flex-col items-center text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background text-sm font-bold mb-2">
                    {item.step}
                  </div>
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                  {i < 2 && (
                    <span
                      className="hidden sm:inline text-muted-foreground text-xs absolute -right-2 top-2.5"
                      aria-hidden="true"
                    >
                      &#8594;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-6 h-6 text-primary mb-2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground font-bold">
                Set Goals
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Calories, macros, and dietary needs
              </p>
            </div>
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-6 h-6 text-primary mb-2"
              >
                <path d="M12 20V10M18 20V4M6 20v-4" />
              </svg>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground font-bold">
                Track Macros
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Real-time nutrient tracking daily
              </p>
            </div>
            <div className="flex flex-col items-center p-4 card-elevation border border-border rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-6 h-6 text-primary mb-2"
              >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground font-bold">
                Grocery Lists
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Auto-generated shopping lists
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
              {"/// Today's Log"}
            </p>
            <span className="text-xs text-muted-foreground">0 items logged</span>
          </div>
          <div data-testid="empty-log-state" className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-8 h-8 text-primary"
              >
                <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
              </svg>
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                </svg>
                Log Your First Meal
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
