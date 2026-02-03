/**
 * Clear all Zustand stores on sign-out
 *
 * This utility ensures that when a user signs out, all client-side state
 * is cleared to prevent data leaks between user sessions.
 */

import { useUserStore } from './useUserStore';
import { useToastStore } from '../toast-store';

/**
 * Clear all Zustand stores and their localStorage persistence
 *
 * Call this function when:
 * - User explicitly signs out
 * - Clerk session ends (production)
 * - Dev auth session ends (development)
 *
 * This ensures that the next user signing in won't see any stale data
 * from the previous user's session.
 */
export function clearAllStores(): void {
  // Clear user store (profile, onboarding status)
  useUserStore.getState().clearAllState();

  // Clear toast notifications
  useToastStore.getState().clearAll();

  // Clear all localStorage items
  if (typeof window !== 'undefined') {
    // Clear Zustand persist storage (with hyphen)
    localStorage.removeItem('zsn-user-store');

    // Clear onboarding wizard localStorage (with underscore)
    localStorage.removeItem('zsn_user_profile');
    localStorage.removeItem('zsn_onboarding_complete');

    // Clear any other app-specific localStorage items (both patterns)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('zsn-') || key.startsWith('zsn_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * Initialize sign-out listeners for Clerk (production mode)
 *
 * This sets up a listener that automatically clears all stores when
 * Clerk signs the user out (e.g., token expiration, manual sign-out).
 *
 * Should be called once at app startup (e.g., in root layout or provider).
 */
export function initSignOutListeners(): void {
  if (typeof window === 'undefined') return;

  // Only set up Clerk listeners if Clerk is available
  if (window.Clerk) {
    // @ts-ignore - Clerk is loaded via script tag in production
    window.Clerk.addListener('sign-out', () => {
      clearAllStores();
    });
  }
}
