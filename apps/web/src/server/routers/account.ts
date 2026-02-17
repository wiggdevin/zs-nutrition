import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, deactivatedUserProcedure } from '../trpc';
import type { DeactivatedAuthContext } from '../trpc';

export const accountRouter = router({
  /**
   * Returns account status for the current user.
   * Callable by deactivated users (used by AccountStatusGate).
   */
  getAccountStatus: deactivatedUserProcedure.query(({ ctx }) => {
    const { isActive, deactivatedAt } = ctx as DeactivatedAuthContext;
    return { isActive, deactivatedAt };
  }),

  /**
   * Reactivates a deactivated account.
   * Sets isActive=true, clears deactivatedAt, restores most recent meal plan.
   */
  reactivateAccount: deactivatedUserProcedure.mutation(async ({ ctx }) => {
    const { dbUserId, isActive } = ctx as DeactivatedAuthContext;

    if (isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Account is already active',
      });
    }

    await ctx.prisma.user.update({
      where: { id: dbUserId },
      data: { isActive: true, deactivatedAt: null },
    });

    // Restore the most recently deactivated meal plan (if any)
    const latestPlan = await ctx.prisma.mealPlan.findFirst({
      where: { userId: dbUserId, status: 'replaced', deletedAt: null },
      orderBy: { generatedAt: 'desc' },
    });

    if (latestPlan) {
      await ctx.prisma.mealPlan.update({
        where: { id: latestPlan.id },
        data: { isActive: true, status: 'active' },
      });
    }

    return { success: true, message: 'Account reactivated successfully.' };
  }),

  /**
   * Permanently deletes the user's account and all associated data.
   * CASCADE FKs handle child record deletion.
   * Attempts to delete the Clerk user (fire-and-forget).
   */
  deleteAccount: deactivatedUserProcedure.mutation(async ({ ctx }) => {
    const { dbUserId, userId: clerkUserId } = ctx as DeactivatedAuthContext;

    // Hard delete — CASCADE FKs remove all child records
    await ctx.prisma.user.delete({
      where: { id: dbUserId },
    });

    // Fire-and-forget Clerk user deletion
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerk = await clerkClient();
      await clerk.users.deleteUser(clerkUserId);
    } catch {
      // If Clerk deletion fails, user can re-register and auto-create a fresh DB record
    }

    return { success: true, message: 'Account permanently deleted.' };
  }),

  /**
   * Soft-deactivates the user's account.
   * Moved from user router — only active users can deactivate.
   */
  deactivateAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const dbUserId = ctx.dbUserId;

    const user = await ctx.prisma.user.findUnique({
      where: { id: dbUserId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Account is already deactivated',
      });
    }

    await ctx.prisma.user.update({
      where: { id: dbUserId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    await ctx.prisma.mealPlan.updateMany({
      where: { userId: dbUserId, isActive: true, deletedAt: null },
      data: { isActive: false, status: 'replaced' },
    });

    return {
      success: true,
      message: 'Account deactivated successfully. All data has been preserved.',
    };
  }),
});
