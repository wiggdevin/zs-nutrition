import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/safe-logger';
import { isUniqueConstraintError } from '@/lib/prisma-utils';

// Re-export for backwards compatibility with existing imports
export { isUniqueConstraintError };

/**
 * Utility functions for MealPlan management including soft deletes
 * and handling of the partial unique constraint on active plans.
 */

/**
 * Soft delete a MealPlan by setting deletedAt timestamp.
 * This preserves TrackedMeal records that reference the plan.
 *
 * @param prisma - Prisma client instance (or transaction)
 * @param planId - The ID of the plan to soft delete
 * @param userId - The user ID (for security validation)
 * @returns The updated plan or null if not found
 */
export async function softDeleteMealPlan(
  prisma: PrismaClient | Prisma.TransactionClient,
  planId: string,
  userId: string
): Promise<{ id: string; deletedAt: Date } | null> {
  // First verify the plan exists and belongs to the user
  const existingPlan = await prisma.mealPlan.findFirst({
    where: { id: planId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!existingPlan) {
    return null;
  }

  // Soft delete: set deletedAt, deactivate, and mark status as deleted
  const updatedPlan = await prisma.mealPlan.update({
    where: { id: planId },
    data: {
      deletedAt: new Date(),
      isActive: false,
      status: 'deleted',
    },
    select: { id: true, deletedAt: true },
  });

  logger.info(`[softDeleteMealPlan] Soft deleted plan ${planId} for user ${userId}`);
  return updatedPlan as { id: string; deletedAt: Date };
}

/**
 * Activate a MealPlan while handling the partial unique constraint.
 * The constraint ensures only one active (isActive=true, deletedAt=null) plan per user.
 *
 * This function handles race conditions gracefully:
 * 1. First attempts to activate the plan
 * 2. If unique constraint violation (P2002), deactivates other plans and retries
 *
 * @param prisma - Prisma client instance
 * @param planId - The ID of the plan to activate
 * @param userId - The user ID
 */
export async function activateMealPlanWithConstraintHandling(
  prisma: PrismaClient,
  planId: string,
  userId: string
): Promise<void> {
  try {
    // Attempt to activate the plan directly
    await prisma.mealPlan.update({
      where: { id: planId },
      data: { isActive: true, status: 'active' },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // Unique constraint violation - another active plan exists
      // This can happen due to race conditions or data inconsistency
      logger.warn(
        `[activateMealPlanWithConstraintHandling] Unique constraint hit for user ${userId}, deactivating other plans`
      );

      // Deactivate all other active plans for this user first
      await prisma.mealPlan.updateMany({
        where: {
          userId,
          isActive: true,
          deletedAt: null,
          id: { not: planId },
        },
        data: { isActive: false, status: 'replaced' },
      });

      // Retry the activation
      await prisma.mealPlan.update({
        where: { id: planId },
        data: { isActive: true, status: 'active' },
      });

      logger.info(
        `[activateMealPlanWithConstraintHandling] Successfully activated plan ${planId} after deactivating conflicts`
      );
    } else {
      // Re-throw non-constraint errors
      throw error;
    }
  }
}

/**
 * Deactivate all active plans for a user.
 * Used when creating a new plan or as a fallback during constraint handling.
 *
 * @param prisma - Prisma client instance (or transaction)
 * @param userId - The user ID
 * @param excludePlanId - Optional plan ID to exclude from deactivation
 */
export async function deactivateAllUserPlans(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  excludePlanId?: string
): Promise<number> {
  const where: Prisma.MealPlanWhereInput = {
    userId,
    isActive: true,
    deletedAt: null,
  };

  if (excludePlanId) {
    where.id = { not: excludePlanId };
  }

  const result = await prisma.mealPlan.updateMany({
    where,
    data: { isActive: false, status: 'replaced' },
  });

  if (result.count > 0) {
    logger.info(`[deactivateAllUserPlans] Deactivated ${result.count} plans for user ${userId}`);
  }

  return result.count;
}
