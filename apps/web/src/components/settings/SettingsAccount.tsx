"use client";

import { useState } from "react";
import { clearAllStores } from "@/lib/stores/clearStores";
import { useAuth } from "@clerk/nextjs";

export default function SettingsAccount() {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  // Get Clerk's signOut function (undefined in dev mode)
  const { signOut: clerkSignOut } = useAuth();

  async function handleSignOut() {
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
        await fetch("/api/dev-auth/signout", { method: "POST" });
        window.location.href = "/sign-in";
      }
    } catch {
      setSigningOut(false);
    }
  }

  async function handleDeactivate() {
    try {
      setDeactivating(true);
      const res = await fetch("/api/account/deactivate", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to deactivate account");
      }
      // Clear all stores before signing out
      clearAllStores();
      // Sign out after successful deactivation
      if (clerkSignOut) {
        await clerkSignOut();
        // Clerk will handle the redirect automatically
      } else {
        // Dev mode: Clear the dev auth cookie via API, then redirect
        await fetch("/api/dev-auth/signout", { method: "POST" });
        window.location.href = "/sign-in";
      }
    } catch {
      setDeactivating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Sign Out */}
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" data-testid="signout-section">
        <div className="mb-4">
          <h2 className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
            <span className="text-[#f97316]">///</span> Session
          </h2>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          data-testid="settings-signout-btn"
          className="w-full rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#fafafa] hover:bg-[#252525] transition-colors disabled:opacity-50"
        >
          {signingOut ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing Out...
            </span>
          ) : (
            "Sign Out"
          )}
        </button>
      </div>

      {/* Account Deactivation */}
      <div className="rounded-2xl border border-red-500/20 bg-[#1a1a1a] p-6" data-testid="deactivation-section">
        <div className="mb-4">
          <h2 className="text-xs font-mono tracking-wider uppercase text-red-400">
            <span className="text-red-500">///</span> Danger Zone
          </h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">
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
                onClick={handleDeactivate}
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
                  "Yes, Deactivate"
                )}
              </button>
              <button
                onClick={() => setShowDeactivateConfirm(false)}
                className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#252525] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
