// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Suppress React's error boundary console output in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error');
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeDefined();
  });

  it('shows default fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText(/unexpected error/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined();
  });

  it('does not show children after error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Child content')).toBeNull();
  });

  it('shows error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test render error')).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('Try Again button resets the error state', () => {
    // We need a component whose throwing behavior can change between renders.
    // After reset, ErrorBoundary re-renders children. If child no longer throws, it recovers.
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Recoverable error');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();

    // Fix the component before clicking Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered')).toBeDefined();
  });

  it('uses custom fallback when provided', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <p>Custom error: {error.message}</p>
        <button onClick={reset}>Custom Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error: Test render error')).toBeDefined();
    expect(screen.getByRole('button', { name: /custom reset/i })).toBeDefined();
    // Default UI should not be present
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('custom fallback reset button works', () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Custom recoverable');
      return <div>Custom recovered</div>;
    }

    const customFallback = (_error: Error, reset: () => void) => (
      <button onClick={reset}>Custom Reset</button>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /custom reset/i }));

    expect(screen.getByText('Custom recovered')).toBeDefined();
  });

  it('logs error via componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // React and our ErrorBoundary both call console.error
    expect(consoleSpy).toHaveBeenCalled();
    const calls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(
      calls.some((msg: string) => typeof msg === 'string' && msg.includes('[ErrorBoundary]'))
    ).toBe(true);
  });
});
