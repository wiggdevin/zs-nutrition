'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/safe-logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('[Marketing Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Page Error</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          We encountered an error loading this page.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 px-4 py-2 rounded border border-border bg-background text-foreground font-medium hover:bg-muted transition-colors text-center"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
