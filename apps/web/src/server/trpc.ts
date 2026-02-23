import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import superjson from 'superjson';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getClerkUserId, getAuthenticatedUser } from '@/lib/auth';
import { generalLimiter, checkRateLimit } from '@/lib/rate-limit';

export type Context = {
  userId: string | null;
  prisma: typeof prisma;
  requestId: string;
};

export type AuthedContext = Context & {
  userId: string;
  dbUserId: string;
};

export type DeactivatedAuthContext = AuthedContext & {
  isActive: boolean;
  deactivatedAt: Date | null;
};

export async function createContext(): Promise<Context> {
  const userId = await getClerkUserId();
  const headersList = await headers();
  const requestId = headersList.get('x-request-id') || crypto.randomUUID();

  return {
    userId,
    prisma,
    requestId,
  };
}

/**
 * Format Zod validation errors into user-friendly messages.
 * Each field error is formatted as "fieldName: error message"
 */
function formatZodError(error: ZodError): string {
  const fieldErrors = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'input';
    return `${field}: ${issue.message}`;
  });
  return fieldErrors.join('; ');
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: error.cause instanceof ZodError ? formatZodError(error.cause) : shape.message,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware that enforces authentication using lightweight auth
// This only loads the user ID, not the full profile - saving a database query
// for the ~61% of procedures that don't need profile data
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  const clerkUserId = ctx.userId;
  if (!clerkUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to access this resource.',
    });
  }

  // Use lightweight auth - only gets/creates user ID, not full profile
  const user = await getAuthenticatedUser(clerkUserId);
  if (!user) {
    // getAuthenticatedUser returns null if user is deactivated
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account is deactivated',
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: clerkUserId,
      dbUserId: user.id,
    },
  });
});

const rateLimit = t.middleware(async ({ ctx, next }) => {
  if (ctx.userId && generalLimiter) {
    const result = await checkRateLimit(generalLimiter, ctx.userId);
    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil(((result.reset || Date.now()) - Date.now()) / 1000));
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter,
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        }),
      });
    }
  }
  return next();
});

export const protectedProcedure = t.procedure.use(enforceAuth).use(rateLimit);

// Middleware that authenticates the user but does NOT block deactivated accounts.
// Used by account lifecycle procedures (reactivation, deletion, status check).
const enforceAuthAllowDeactivated = t.middleware(async ({ ctx, next }) => {
  const clerkUserId = ctx.userId;
  if (!clerkUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to access this resource.',
    });
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, isActive: true, deactivatedAt: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email: `pending-${clerkUserId}@placeholder.com`,
      },
      select: { id: true, isActive: true, deactivatedAt: true },
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: clerkUserId,
      dbUserId: user.id,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
    },
  });
});

export const deactivatedUserProcedure = t.procedure.use(enforceAuthAllowDeactivated).use(rateLimit);
