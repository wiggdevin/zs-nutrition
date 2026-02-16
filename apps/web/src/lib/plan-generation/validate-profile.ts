import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { planGenerationLimiter, checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';

type UserWithProfile = Awaited<ReturnType<typeof findOrCreateUserWithProfile>>;

/**
 * Authenticate the user and apply rate limiting for plan generation.
 * Returns `{ clerkUserId }` on success, or a NextResponse error to return early.
 */
export async function authenticateAndRateLimit(): Promise<
  { clerkUserId: string } | { errorResponse: Response }
> {
  let clerkUserId: string;
  try {
    ({ clerkUserId } = await requireActiveUser());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Account is deactivated' ? 403 : 401;
    return { errorResponse: NextResponse.json({ error: message }, { status }) };
  }

  const rateLimitResult = await checkRateLimit(planGenerationLimiter, clerkUserId);
  if (rateLimitResult && !rateLimitResult.success) {
    return { errorResponse: rateLimitExceededResponse(rateLimitResult.reset) };
  }

  return { clerkUserId };
}

/**
 * Find or create a user by clerkUserId, including the active profile.
 */
export async function findOrCreateUserWithProfile(clerkUserId: string) {
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      profiles: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email: `${clerkUserId}@dev.local`,
      },
      include: {
        profiles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });
  }

  return user;
}

/**
 * Validate that the user has an active profile.
 * Returns the profile or a NextResponse error.
 */
export function validateActiveProfile(user: UserWithProfile) {
  const activeProfile = user.profiles[0];
  if (!activeProfile) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No active profile found. Please complete onboarding first.' },
        { status: 400 }
      ),
    };
  }

  return { activeProfile };
}
