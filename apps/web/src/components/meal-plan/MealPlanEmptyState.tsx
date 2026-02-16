'use client';

interface MealPlanEmptyStateProps {
  error: string | null;
  onRetry: () => void;
}

export function MealPlanEmptyState({ error, onRetry }: MealPlanEmptyStateProps) {
  const isNetworkError =
    error?.toLowerCase().includes('failed to load') ||
    error?.toLowerCase().includes('network') ||
    error?.toLowerCase().includes('fetch');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center" data-testid="meal-plan-empty-state">
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl">{isNetworkError ? '⚠️' : '📋'}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground" data-testid="empty-state-message">
            {isNetworkError ? 'Connection Error' : 'No Active Plan'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="empty-state-description">
            {error || "You haven't generated a meal plan yet."}
          </p>
          <div className="mt-6 flex flex-col gap-3 items-center">
            {isNetworkError && (
              <button
                onClick={onRetry}
                data-testid="retry-button"
                className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
              >
                Retry
              </button>
            )}
            <a
              href="/generate"
              className={`inline-block rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                isNetworkError
                  ? 'border border-border text-muted-foreground hover:bg-secondary'
                  : 'bg-primary text-background hover:bg-primary/90'
              }`}
              data-testid="generate-plan-cta"
            >
              Generate Plan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
