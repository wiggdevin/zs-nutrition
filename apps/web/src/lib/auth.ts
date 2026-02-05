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
