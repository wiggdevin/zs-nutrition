'use client';

interface SwapErrorToastProps {
  error: string;
  onDismiss: () => void;
}

export function SwapErrorToast({ error, onDismiss }: SwapErrorToastProps) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 shadow-lg"
      data-testid="swap-error-toast"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-500">Meal Swap Failed</p>
          <p className="mt-1 text-xs text-red-400">{error}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label="Dismiss error"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
