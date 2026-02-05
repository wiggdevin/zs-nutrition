import { cookies } from 'next/headers';
import { prisma } from './prisma';

// Single source of truth for dev-mode detection (edge-compatible).
// Re-exported so existing `import { isDevMode } from '@/lib/auth'` still works.
import { isDevMode } from './dev-mode';
export { isDevMode } from './dev-mode';

/**
 * Returns the authenticated Clerk user ID.
 *
 * Production: delegates to Clerk's auth().
 * Dev mode: reads the dev-user-id cookie (set by /api/dev-auth/*),
 * looks up the corresponding clerkUserId, and returns it.
 * Falls back to dev_user_001 only when no cookie is present
 * (e.g. seed-plan or other headless dev flows).
 */
export async function getClerkUserId(): Promise<string | null> {
  if (isDevMode) {
    const cookieStore = await cookies();
    const devUserId = cookieStore.get('dev-user-id')?.value;
    if (devUserId) {
      const user = await prisma.user.findUnique({
        where: { id: devUserId },
        select: { clerkUserId: true },
      });
      if (user) return user.clerkUserId;
    }
    // No dev cookie → not authenticated
    return null;
  }

  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  return userId;
}

/**
 * Check if the authenticated user's account is deactivated.
 * Returns true if the account exists and is deactivated (isActive=false).
 * Used by API routes that need to return a specific "account deactivated" error.
 */
export async function requireActiveUser(): Promise<{
  clerkUserId: string;
  dbUserId: string;
}> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, isActive: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  return { clerkUserId, dbUserId: user.id };
}

export async function isAccountDeactivated(): Promise<boolean> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return false;

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { isActive: true },
  });

  return user ? !user.isActive : false;
}

// ============================================================================
// Lightweight Auth Functions (Task 3.8 - Architecture Consolidation)
// ============================================================================

/**
 * Lightweight auth - only get/create the user ID.
 * Use this for most endpoints that just need to verify the user exists.
 *
 * This function is optimized for the ~61% of tRPC procedures that only need
 * the user ID (ctx.dbUserId) and don't require profile or onboarding data.
 *
 * @param clerkUserId - The Clerk user ID from authentication
 * @returns User object with id and isActive, or null if user is deactivated
 */
export async function getAuthenticatedUser(clerkUserId: string): Promise<{
  id: string;
  isActive: boolean;
  deactivatedAt: Date | null;
} | null> {
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, isActive: true, deactivatedAt: true },
  });

  if (!user) {
    // Create user with minimal data - email will be updated later
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email: `pending-${clerkUserId}@placeholder.com`,
      },
      select: { id: true, isActive: true, deactivatedAt: true },
    });
  }

  if (!user.isActive) return null;
  return user;
}

/**
 * Full profile - only call when you need profile/onboarding data.
 * Use this for profile updates, plan generation, etc.
 *
 * This function is for the ~26% of procedures that actually need
 * the full user profile with onboarding state and active profile data.
 *
 * @param userId - The internal database user ID (not Clerk ID)
 * @returns Full user object with onboarding and active profiles
 */
export async function getUserWithProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      onboarding: true,
      profiles: {
        where: { isActive: true },
        take: 1,
      },
    },
  });
}

/**
 * Get just the active profile for a user.
 * More efficient than getUserWithProfile when you only need profile data.
 *
 * @param userId - The internal database user ID (not Clerk ID)
 * @returns The active UserProfile or null
 */
export async function getActiveProfile(userId: string) {
  return prisma.userProfile.findFirst({
    where: { userId, isActive: true },
  });
}

/**
 * @deprecated Use getAuthenticatedUser() for most cases.
 * This function loads full profile data on every request, which is unnecessary
 * for ~61% of tRPC procedures that only need the user ID.
 *
 * Migration guide:
 * - For procedures that only need userId: use getAuthenticatedUser()
 * - For procedures that need profile: call getActiveProfile() or getUserWithProfile() explicitly
 */
export async function getOrCreateUser() {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return null;

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { onboarding: true, profiles: { where: { isActive: true } } },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email: `${clerkUserId}@placeholder.com`,
      },
      include: { onboarding: true, profiles: { where: { isActive: true } } },
    });
  }

  // Block deactivated accounts from accessing the app
  if (!user.isActive) return null;

  return user;
}
