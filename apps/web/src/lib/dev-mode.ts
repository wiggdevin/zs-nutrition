/**
 * Canonical dev-mode detection for the entire app.
 *
 * Edge-compatible: this file has zero Node.js-only imports so it can be
 * safely used by Next.js middleware (Edge Runtime) as well as regular
 * server components and API routes.
 *
 * A single source of truth prevents the "auth.ts says prod but middleware
 * says dev" class of bugs.
 */

const clerkSecret = process.env.CLERK_SECRET_KEY ?? '';
const clerkPublishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

// Fail hard if production is missing real Clerk keys
if (process.env.NODE_ENV === 'production') {
  if (
    !clerkSecret ||
    clerkSecret === 'sk_test_placeholder' ||
    clerkSecret === 'sk_...' ||
    clerkSecret.startsWith('sk_...')
  ) {
    throw new Error('FATAL: CLERK_SECRET_KEY is required in production');
  }
  if (!clerkPublishable || clerkPublishable === 'pk_...' || clerkPublishable.startsWith('pk_...')) {
    throw new Error('FATAL: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production');
  }
}

export const isDevMode =
  process.env.NODE_ENV !== 'production' &&
  // No key configured at all
  (!clerkSecret ||
    // Explicit placeholder value
    clerkSecret === 'sk_test_placeholder' ||
    // Empty string (redundant with !clerkSecret but explicit for clarity)
    clerkSecret === '' ||
    // Skeleton/placeholder key (e.g. "sk_...")
    clerkSecret === 'sk_...' ||
    clerkSecret.startsWith('sk_...') ||
    // Publishable key placeholders
    clerkPublishable === 'pk_...' ||
    clerkPublishable.startsWith('pk_...'));
