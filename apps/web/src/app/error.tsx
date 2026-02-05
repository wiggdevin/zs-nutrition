'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/safe-logger'

/**
 * Global Error Boundary for Next.js App Router.
 *
 * Catches unhandled errors in page components and shows a friendly
 * error message instead of raw stack traces or technical details.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console for development debugging.
    // In production, this could be sent to an error reporting service.
    logger.error('[GlobalError] Unhandled error caught:', error.digest || 'no-digest')
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="global-error-boundary">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        {/* Error Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Message */}
        <div>
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted-foreground mb-3">
            /// ERROR
          </p>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Something went wrong<span className="text-primary">.</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="error-friendly-message">
            We encountered an unexpected error. Don&apos;t worry — your data is safe.
            Please try again, and if the problem persists, contact support.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            data-testid="error-retry-button"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-background text-sm font-bold uppercase tracking-wide rounded-xl transition-colors shadow-lg shadow-primary/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground hover:text-foreground hover:bg-card text-sm font-bold uppercase tracking-wide rounded-xl transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}
