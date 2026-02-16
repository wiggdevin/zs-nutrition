'use client';

import { useState } from 'react';
import { clearAllStores } from '@/lib/stores/clearStores';
import { ClerkSignOutHandler } from '@/hooks/useClerkSignOut';
import { trpc } from '@/lib/trpc';

export default function SettingsAccount() {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const deactivateAccountMutation = trpc.user.deactivateAccount.useMutation();

  async function handleSignOut(clerkSignOut?: () => Promise<void>) {
    try {
      setSigningOut(true);

      // Clear all Zustand stores before signing out
      clearAllStores();

      // If Clerk is available, use Clerk's signOut (production mode)
      if (clerkSignOut) {
        await clerkSignOut();
        // Clerk will handle the redirect automatically
      } else {
        // Dev mode: Clear the dev auth cookie via API, then redirect
        await fetch('/api/dev-auth/signout', { method: 'POST' });
        window.location.href = '/sign-in';
      }
    } catch {
      setSigningOut(false);
    }
  }

  async function handleDeactivate(clerkSignOut?: () => Promise<void>) {
    try {
      setDeactivating(true);
      // Use tRPC mutation instead of REST endpoint
      await deactivateAccountMutation.mutateAsync();
      // Clear all stores before signing out
      clearAllStores();
      // Sign out after successful deactivation
      if (clerkSignOut) {
        await clerkSignOut();
        // Clerk will handle the redirect automatically
      } else {
        // Dev mode: Clear the dev auth cookie via API, then redirect
        await fetch('/api/dev-auth/signout', { method: 'POST' });
        window.location.href = '/sign-in';
      }
    } catch {
      setDeactivating(false);
    }
  }

  return (
    <ClerkSignOutHandler>
      {(clerkSignOut) => (
        <div className="space-y-6">
          {/* Sign Out */}
          <div
            className="rounded-2xl border border-border bg-card p-6"
            data-testid="signout-section"
          >
            <div className="mb-4">
              <h2 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                <span className="text-primary">{'///'}</span> Session
              </h2>
            </div>
            <button
              onClick={() => handleSignOut(clerkSignOut)}
              disabled={signingOut}
              data-testid="settings-signout-btn"
              className="w-full rounded-lg border border-border bg-card px-6 py-3 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {signingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing Out...
                </span>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>

          {/* Account Deactivation */}
          <div
            className="rounded-2xl border border-red-500/20 bg-card p-6"
            data-testid="deactivation-section"
          >
            <div className="mb-4">
              <h2 className="text-xs font-mono tracking-wider uppercase text-red-400">
                <span className="text-red-500">{'///'}</span> Danger Zone
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deactivate your account. Your data will be preserved but inaccessible.
              </p>
            </div>

            {!showDeactivateConfirm ? (
              <button
                onClick={() => setShowDeactivateConfirm(true)}
                data-testid="settings-deactivate-btn"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Deactivate Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-400 font-medium">
                  Are you sure? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeactivate(clerkSignOut)}
                    disabled={deactivating}
                    data-testid="settings-deactivate-confirm"
                    className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deactivating ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Deactivating...
                      </span>
                    ) : (
                      'Yes, Deactivate'
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeactivateConfirm(false)}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ClerkSignOutHandler>
  );
}
