'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
              <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              We encountered an unexpected error. Try refreshing the page or contact support if the
              problem persists.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 rounded bg-muted border border-border overflow-auto max-h-40">
                <p className="text-xs font-mono text-destructive">{this.state.error.message}</p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
