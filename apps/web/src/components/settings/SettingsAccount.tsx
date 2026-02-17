'use client';

import { useState } from 'react';
import { clearAllStores } from '@/lib/stores/clearStores';
import { ClerkSignOutHandler } from '@/hooks/useClerkSignOut';
import { trpc } from '@/lib/trpc';

export default function SettingsAccount() {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const deactivateAccountMutation = trpc.account.deactivateAccount.useMutation();
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation();

  async function handleSignOut(clerkSignOut?: () => Promise<void>) {
    try {
      setSigningOut(true);
      clearAllStores();
      if (clerkSignOut) {
        await clerkSignOut();
      } else {
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
      await deactivateAccountMutation.mutateAsync();
      clearAllStores();
      if (clerkSignOut) {
        await clerkSignOut();
      } else {
        await fetch('/api/dev-auth/signout', { method: 'POST' });
        window.location.href = '/sign-in';
      }
    } catch {
      setDeactivating(false);
    }
  }

  async function handleDelete(clerkSignOut?: () => Promise<void>) {
    try {
      await deleteAccountMutation.mutateAsync();
      clearAllStores();
      if (clerkSignOut) {
        await clerkSignOut();
      } else {
        await fetch('/api/dev-auth/signout', { method: 'POST' });
        window.location.href = '/sign-in';
      }
    } catch {
      // mutation error state handles UI feedback
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
                Deactivate your account. Your data will be preserved and you can reactivate later.
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
                  Are you sure? Your data will be preserved. You can reactivate later.
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

          {/* Permanent Deletion */}
          <div
            className="rounded-2xl border border-red-500/30 bg-card p-6"
            data-testid="deletion-section"
          >
            <div className="mb-4">
              <h2 className="text-xs font-mono tracking-wider uppercase text-red-400">
                <span className="text-red-500">{'///'}</span> Permanently Delete Account
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                data-testid="settings-delete-btn"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-400 font-medium">
                  This will permanently delete all your data including meal plans, tracking history,
                  and profile. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(clerkSignOut)}
                    disabled={deleteAccountMutation.isPending}
                    data-testid="settings-delete-confirm"
                    className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteAccountMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Deleting...
                      </span>
                    ) : (
                      'Yes, Delete Everything'
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {deleteAccountMutation.isError && (
                  <p className="text-sm text-red-400">
                    Failed to delete account. Please try again.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </ClerkSignOutHandler>
  );
}
