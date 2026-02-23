'use client';

import { useState } from 'react';
import { UserProfile } from '@clerk/nextjs';
import { clearAllStores } from '@/lib/stores/clearStores';
import { ClerkSignOutHandler } from '@/hooks/useClerkSignOut';
import { trpc } from '@/lib/trpc';

export default function SettingsAccountConsolidated() {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const deactivateAccountMutation = trpc.account.deactivateAccount.useMutation();
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation();

  const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
    } catch (err) {
      console.error('[SettingsAccount] Sign out failed:', err);
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
    } catch (err) {
      console.error('[SettingsAccount] Account deactivation failed:', err);
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
    } catch (err) {
      // tRPC mutation error state handles UI feedback via deleteAccountMutation.isError
      console.error('[SettingsAccount] Account deletion failed:', err);
    }
  }

  return (
    <ClerkSignOutHandler>
      {(clerkSignOut) => (
        <div
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          data-testid="account-section"
        >
          {/* Section A — Login & Security (Clerk UserProfile embed) */}
          {hasClerkKey ? (
            <div>
              <div className="mb-4">
                <h3 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                  <span className="text-primary">{'///'}</span> Login & Security
                </h3>
              </div>
              <div className="cl-userProfile-root">
                <UserProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      cardBox: 'w-full shadow-none',
                      card: 'bg-transparent shadow-none border-none w-full',
                      navbar: 'hidden',
                      navbarMobileMenuButton: 'hidden',
                      pageScrollBox: 'p-0 !min-h-0 !h-auto overflow-visible',
                      page: 'gap-3 !min-h-0',
                      profileSection: 'border-border py-2',
                      profileSectionContent: 'gap-2',
                      profileSectionTitleText:
                        'text-muted-foreground font-mono text-xs uppercase tracking-wider',
                      formFieldInput: 'bg-background border-border text-foreground rounded-lg',
                      formFieldLabel: 'text-muted-foreground',
                      formButtonPrimary:
                        'bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg',
                      formButtonReset: 'text-muted-foreground',
                      badge: 'bg-primary/10 text-primary border-primary/20',
                      menuButton: 'text-muted-foreground',
                      menuList: 'bg-card border-border',
                      menuItem: 'text-foreground hover:bg-secondary',
                      avatarBox: 'border-border',
                    },
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                  <span className="text-primary">{'///'}</span> Login & Security
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Authentication is running in development mode. Credential management is available
                when Clerk is configured.
              </p>
            </div>
          )}

          {/* Section B — Sign Out */}
          <div data-testid="signout-section">
            <button
              onClick={() => handleSignOut(clerkSignOut)}
              disabled={signingOut}
              data-testid="settings-signout-btn"
              className="w-full rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-secondary transition-colors disabled:opacity-50 min-h-[44px]"
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

          {/* Section C — Danger Zone */}
          <div className="border-t border-red-500/20 pt-4" data-testid="danger-zone">
            <div className="mb-4">
              <h3 className="text-xs font-mono tracking-wider uppercase text-red-400">
                <span className="text-red-500">{'///'}</span> Danger Zone
              </h3>
            </div>

            <div className="space-y-3">
              <p className="mb-2 text-sm text-muted-foreground">
                Deactivate (preserves data) or permanently delete your account.
              </p>

              {!showDeactivateConfirm && !showDeleteConfirm ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowDeactivateConfirm(true)}
                    data-testid="settings-deactivate-btn"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-red-400 hover:bg-red-500/20 transition-colors min-h-[44px]"
                  >
                    Deactivate Account
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="settings-delete-btn"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-red-400 hover:bg-red-500/20 transition-colors min-h-[44px]"
                  >
                    Delete Account
                  </button>
                </div>
              ) : showDeactivateConfirm ? (
                <div className="space-y-3" data-testid="deactivation-section">
                  <p className="text-sm text-red-400 font-medium">
                    Are you sure? Your data will be preserved. You can reactivate later.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleDeactivate(clerkSignOut)}
                      disabled={deactivating}
                      data-testid="settings-deactivate-confirm"
                      className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px]"
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
                      className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors min-h-[44px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3" data-testid="deletion-section">
                  <p className="text-sm text-red-400 font-medium">
                    This will permanently delete all your data including meal plans, tracking
                    history, and profile. This action cannot be undone.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleDelete(clerkSignOut)}
                      disabled={deleteAccountMutation.isPending}
                      data-testid="settings-delete-confirm"
                      className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px]"
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
                      className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors min-h-[44px]"
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
        </div>
      )}
    </ClerkSignOutHandler>
  );
}
