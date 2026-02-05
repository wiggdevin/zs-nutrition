import { Prisma } from '@prisma/client';

/**
 * Check if an error is a Prisma unique constraint violation (P2002).
 * Used to handle race conditions where concurrent requests try to create the same record.
 *
 * Common use cases:
 * - Duplicate meal logging from multiple tabs
 * - Concurrent plan activation causing unique constraint violation
 * - Race conditions in record creation
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
