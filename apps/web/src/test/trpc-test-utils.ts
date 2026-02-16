import { appRouter } from '@/server/routers/_app';
import { prisma } from '@/lib/prisma';
import type { Context, AuthedContext } from '@/server/trpc';
import { randomUUID } from 'crypto';

/**
 * Generate a valid UUID for testing.
 * Simply returns a random UUID - the prefix parameter is ignored for simplicity.
 */
export function testUUID(_prefix?: string): string {
  return randomUUID();
}

/**
 * Create a test context with optional overrides for testing tRPC procedures.
 * This allows us to simulate authenticated users without needing actual auth tokens.
 */
export function createTestContext(
  overrides?: Partial<{
    userId: string;
    dbUserId: string;
  }>
): Context {
  return {
    userId: overrides?.userId ?? 'test-clerk-user-id',
    prisma,
    requestId: randomUUID(),
  };
}

/**
 * Create an authenticated test context that includes dbUserId.
 * This simulates a fully authenticated user who has passed the enforceAuth middleware.
 *
 * If only dbUserId is provided, userId will be set to the same value, which works with
 * the test mock of getAuthenticatedUser that returns { id: clerkId }.
 */
export function createAuthedTestContext(overrides?: {
  userId?: string;
  dbUserId?: string;
}): AuthedContext {
  const dbUserId = overrides?.dbUserId ?? testUUID();
  const userId = overrides?.userId ?? dbUserId; // Use dbUserId as userId if not specified

  return {
    userId,
    dbUserId,
    prisma,
    requestId: randomUUID(),
  };
}

/**
 * Create a tRPC caller for testing.
 * This allows us to call tRPC procedures directly without HTTP requests.
 */
export function createCaller(ctx: Context | AuthedContext) {
  return appRouter.createCaller(ctx);
}
