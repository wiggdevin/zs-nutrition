'use client';

import { useEffect } from 'react';
import { clearAllStores } from '@/lib/stores/clearStores';

/**
 * SignOutListener
 *
 * Monitors authentication state and clears all Zustand stores when the user signs out.
 *
 * In development mode: Uses MutationObserver to watch for DOM changes that indicate
 * sign-out (navigation to sign-in page).
 *
 * In production mode: Sets up a Clerk listener to detect sign-out events.
 */
export function SignOutListener() {
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check if we're in Clerk mode
    const isClerkMode = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (isClerkMode) {
      // Production mode: Set up Clerk sign-out listener
      // We use a polling approach to check if Clerk is loaded
      const clerkCheckInterval = setInterval(() => {
        // @ts-ignore - Clerk is loaded globally
        if (window.Clerk && window.Clerk.listener) {
          clearInterval(clerkCheckInterval);

          // @ts-ignore
          window.Clerk.addListener('tokenRemoved', () => {
            // Clear all stores when token is removed (sign-out)
            clearAllStores();
          });
        }
      }, 100);

      // Cleanup interval on unmount
      return () => clearInterval(clerkCheckInterval);
    } else {
      // Development mode: Watch for navigation to sign-in page
      // This indicates the user has signed out
      const currentPath = window.location.pathname;

      // If we're already on sign-in page, clear stores
      if (currentPath === '/sign-in' || currentPath === '/sign-up') {
        clearAllStores();
      }

      // Set up a visibility change listener to detect when user returns to tab
      // after being redirected to sign-in
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const newPath = window.location.pathname;
          if ((newPath === '/sign-in' || newPath === '/sign-up') && currentPath !== newPath) {
            // User was redirected to sign-in, clear stores
            clearAllStores();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  return null;
}
