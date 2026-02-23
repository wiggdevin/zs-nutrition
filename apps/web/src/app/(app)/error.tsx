'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/safe-logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Error in Dashboard</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Something went wrong while loading this page.
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-4 p-3 rounded bg-muted border border-border overflow-auto max-h-40">
            <p className="text-xs font-mono text-destructive">{error.message}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="flex-1 px-4 py-2 rounded border border-border bg-background text-foreground font-medium hover:bg-muted transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
