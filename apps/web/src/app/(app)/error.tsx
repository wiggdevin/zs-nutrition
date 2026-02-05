'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/safe-logger';

/**
 * Error Boundary for the (app) route group.
 *
 * Catches unhandled errors in protected app routes and provides
 * user-friendly error recovery options.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error('[AppError] Unhandled error in app routes:', error.digest || 'no-digest');
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          {error.message || 'We encountered an error loading this page.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-5 py-2.5 text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
