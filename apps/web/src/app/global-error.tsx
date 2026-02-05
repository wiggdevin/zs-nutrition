'use client';

/**
 * Global Error Boundary for root layout failures.
 *
 * This component catches errors that occur in the root layout itself,
 * which cannot be caught by the regular error.tsx boundary.
 * It must define its own <html> and <body> tags since the root layout
 * may have failed to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
          }}
        >
          <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1.5rem', marginBottom: '1rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              We encountered a critical error. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#22c55e',
                color: '#000000',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
