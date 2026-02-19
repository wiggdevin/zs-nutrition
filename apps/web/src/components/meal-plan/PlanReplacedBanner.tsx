'use client';

interface PlanReplacedBannerProps {
  onViewNewer: () => void;
  onDismiss: () => void;
}

export function PlanReplacedBanner({ onViewNewer, onDismiss }: PlanReplacedBannerProps) {
  return (
    <div
      className="fixed top-14 left-0 right-0 z-40 border-b border-primary/50 bg-card px-4 py-3 md:top-14"
      role="alert"
      aria-live="polite"
      data-testid="plan-replaced-banner"
    >
      <div className="mx-auto max-w-[2400px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p
                className="text-sm font-semibold text-foreground"
                data-testid="plan-replaced-title"
              >
                Plan Updated
              </p>
              <p className="text-xs text-muted-foreground" data-testid="plan-replaced-description">
                A newer meal plan has been generated. You&apos;re viewing an outdated plan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewNewer}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
              data-testid="view-newer-plan-button"
            >
              View New Plan
            </button>
            <button
              onClick={onDismiss}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              data-testid="dismiss-replaced-banner"
              aria-label="Dismiss notification"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
