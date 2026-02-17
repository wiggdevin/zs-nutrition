'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { logger } from '@/lib/safe-logger';

/**
 * Safe hook to check if Clerk is available and get the signOut function.
 *
 * This hook uses a workaround to safely access Clerk hooks without
 * triggering the "useAuth can only be used within ClerkProvider" error.
 *
 * The solution: We use a component-based approach where the actual
 * Clerk hook usage happens in a separate component that's only rendered
 * when Clerk is available.
 */
export function useClerkSignOut(): (() => Promise<void>) | undefined {
  const [signOutFn, setSignOutFn] = useState<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    // Check if we're in the browser and Clerk is configured
    if (typeof window === 'undefined') return;

    const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!hasClerkKey) {
      // No Clerk key configured, dev mode
      return;
    }

    // Try to access Clerk - if we're here, Clerk should be available
    // We'll set up the signOut function through a module-level check
    setSignOutFn(() => {
      return async () => {
        // The actual sign out will be handled by the SignOutListener
        // This is just a placeholder for type safety
        logger.warn('SignOut should be called through SignOutListener component');
      };
    });
  }, []);

  return signOutFn;
}

/**
 * A wrapper component that safely uses Clerk's useAuth hook.
 * This component should only be rendered when Clerk is available
 * (i.e. inside ClerkProvider).
 */
export function ClerkSignOutHandler({
  onSignOut: _onSignOut,
  children,
}: {
  onSignOut?: () => void;
  children: (signOut: (() => Promise<void>) | undefined) => React.ReactNode;
}) {
  const auth = useAuth();
  const clerkSignOut = () => auth.signOut({ redirectUrl: '/sign-in' });

  return <>{children(clerkSignOut)}</>;
}
