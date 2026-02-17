'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { clearAllStores } from '@/lib/stores/clearStores';
import { ClerkSignOutHandler } from '@/hooks/useClerkSignOut';

export default function AccountDeactivatedPage() {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();

  const statusQuery = trpc.account.getAccountStatus.useQuery(undefined, {
    retry: false,
  });

  const reactivateMutation = trpc.account.reactivateAccount.useMutation({
    onSuccess: async () => {
      // Invalidate cached status so AccountStatusGate on /dashboard sees isActive=true
      await utils.account.getAccountStatus.invalidate();
      router.push('/dashboard');
    },
  });

  const deleteMutation = trpc.account.deleteAccount.useMutation();

  // If user is actually active, redirect to dashboard
  useEffect(() => {
    if (statusQuery.data?.isActive) {
      router.replace('/dashboard');
    }
  }, [statusQuery.data, router]);

  async function handleDelete(clerkSignOut?: () => Promise<void>) {
    await deleteMutation.mutateAsync();
    clearAllStores();
    if (clerkSignOut) {
      await clerkSignOut();
    } else {
      await fetch('/api/dev-auth/signout', { method: 'POST' });
      window.location.href = '/sign-in';
    }
  }

  const deactivatedAt = statusQuery.data?.deactivatedAt
    ? new Date(statusQuery.data.deactivatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  if (statusQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (statusQuery.data?.isActive) {
    return null;
  }

  return (
    <ClerkSignOutHandler>
      {(clerkSignOut) => (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                <span className="text-primary">{'///'}</span> Account Deactivated
              </h1>
              <p className="mt-4 text-sm text-muted-foreground">
                Your account was deactivated
                {deactivatedAt ? ` on ${deactivatedAt}` : ''}.
                <br />
                Your data has been preserved and is ready to be restored.
              </p>
            </div>

            {/* Reactivate */}
            <button
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {reactivateMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Reactivating...
                </span>
              ) : (
                'Reactivate My Account'
              )}
            </button>

            {reactivateMutation.isError && (
              <p className="text-center text-sm text-red-400">
                Failed to reactivate. Please try again.
              </p>
            )}

            {/* Delete */}
            <div className="border-t border-border pt-6">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-center text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Permanently Delete Account
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm text-red-400 font-medium">
                    This will permanently delete all your data including meal plans, tracking
                    history, and profile. This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDelete(clerkSignOut)}
                      disabled={deleteMutation.isPending}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? (
                        <span className="flex items-center justify-center gap-2">
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
                  {deleteMutation.isError && (
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
