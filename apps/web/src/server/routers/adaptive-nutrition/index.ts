import { router } from '../../trpc';
import { weightTrackingRouter } from './weight-tracking';
import { nutritionAdjustmentsRouter } from './nutrition-adjustments';
import { adherenceRouter } from './adherence';

/**
 * Adaptive Nutrition Router — merges weight tracking, nutrition adjustments,
 * and adherence sub-routers into a single flat router.
 *
 * All procedures remain at the same path (e.g., adaptiveNutrition.logWeightEntry)
 * to maintain backward compatibility with existing client code.
 */
export const adaptiveNutritionRouter = router({
  // Weight tracking procedures
  logWeightEntry: weightTrackingRouter.logWeightEntry,
  getWeightHistory: weightTrackingRouter.getWeightHistory,
  analyzeWeightTrend: weightTrackingRouter.analyzeWeightTrend,

  // Nutrition adjustment procedures
  suggestCalorieAdjustment: nutritionAdjustmentsRouter.suggestCalorieAdjustment,
  applyCalorieAdjustment: nutritionAdjustmentsRouter.applyCalorieAdjustment,
  getAdjustmentHistory: nutritionAdjustmentsRouter.getAdjustmentHistory,

  // Adherence procedures
  runWeeklyCheck: adherenceRouter.runWeeklyCheck,
  processActivitySync: adherenceRouter.processActivitySync,
  getActivitySyncStatus: adherenceRouter.getActivitySyncStatus,
});
