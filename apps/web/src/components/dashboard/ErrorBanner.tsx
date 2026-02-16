interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div
      className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm"
      role="alert"
      aria-live="assertive"
    >
      {error}
      <button onClick={onDismiss} className="ml-2 underline" aria-label="Dismiss error message">
        Dismiss
      </button>
    </div>
  );
}
