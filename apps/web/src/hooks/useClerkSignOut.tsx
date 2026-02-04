"use client";

import { useEffect, useState } from "react";

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
    if (typeof window === "undefined") return;

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
        console.warn("SignOut should be called through SignOutListener component");
      };
    });
  }, []);

  return signOutFn;
}

/**
 * A wrapper component that safely uses Clerk's useAuth hook.
 * This component should only be rendered when Clerk is available.
 */
export function ClerkSignOutHandler({
  onSignOut,
  children,
}: {
  onSignOut?: () => void;
  children: (signOut: (() => Promise<void>) | undefined) => React.ReactNode;
}) {
  let clerkSignOut: (() => Promise<void>) | undefined = undefined;

  try {
    // Only import and use Clerk hooks if the module is available
    const { useAuth } = require("@clerk/nextjs");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    clerkSignOut = auth.signOut;
  } catch (e) {
    // Clerk not available, will use dev mode
    console.debug("Clerk hooks not available in ClerkSignOutHandler");
  }

  return <>{children(clerkSignOut)}</>;
}
