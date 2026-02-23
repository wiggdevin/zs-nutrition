import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  error: string;
  onReset: () => void;
}

export function ErrorState({ error, onReset }: ErrorStateProps) {
  return (
    <div
      className="bg-card border border-destructive/30 rounded-xl p-6 mb-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-lg font-heading uppercase tracking-wider text-destructive mb-2">
            Analysis Failed
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={onReset}
              aria-label="Try again with a new photo"
              className="bg-border hover:bg-secondary text-foreground font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
