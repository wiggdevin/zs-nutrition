'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import { clearAllStores } from '@/lib/stores/clearStores';

/**
 * ClerkSignOutListener
 *
 * Uses the Clerk SDK's `addListener` to detect sign-out events.
 * Must be rendered inside a ClerkProvider.
 */
function ClerkSignOutListener() {
  const clerk = useClerk();

  useEffect(() => {
    if (!clerk) return;

    const unsubscribe = clerk.addListener(({ session }) => {
      if (!session) {
        clearAllStores();
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [clerk]);

  return null;
}

/**
 * DevSignOutListener
 *
 * Development mode fallback: clears stores when user navigates to sign-in/sign-up pages.
 */
function DevSignOutListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;

    if (currentPath === '/sign-in' || currentPath === '/sign-up') {
      clearAllStores();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const newPath = window.location.pathname;
        if ((newPath === '/sign-in' || newPath === '/sign-up') && currentPath !== newPath) {
          clearAllStores();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}

/**
 * SignOutListener
 *
 * Monitors authentication state and clears all Zustand stores when the user signs out.
 *
 * In production mode (Clerk key present): Uses the Clerk SDK's addListener API.
 * In development mode (no Clerk key): Watches for navigation to sign-in page.
 */
export function SignOutListener() {
  const isClerkMode = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (isClerkMode) {
    return <ClerkSignOutListener />;
  }

  return <DevSignOutListener />;
}
