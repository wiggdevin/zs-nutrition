// ============================================================
// Calorie Adjustment Algorithm
// ============================================================

import { NormalizedActivity, CalorieAdjustmentConfig, CalorieAdjustment } from './types';

/**
 * Default configuration for calorie adjustments
 */
export const DEFAULT_ADJUSTMENT_CONFIG: CalorieAdjustmentConfig = {
  enabled: true,
  safetyFactor: 0.75, // Use 75% of active calories (conservative)
  maxDailyIncrease: 500, // Max 500 calories added per day
  minWorkoutMinutes: 20, // Require at least 20 minutes of exercise
  adjustmentWindow: 4, // Apply adjustment within 4 hours of activity
  requireManualApproval: false, // Auto-apply adjustments
};

/**
 * Calculate calorie adjustment based on activity data
 *
 * Formula: Base Target + (Active Calories × Safety Factor)
 * - Safety factor prevents overestimating calorie burn
 * - Capped at maxDailyIncrease
 * - Only applies if minimum workout duration met
 */
export function calculateCalorieAdjustment(
  baseTarget: number,
  activity: NormalizedActivity,
  config: CalorieAdjustmentConfig = DEFAULT_ADJUSTMENT_CONFIG
): CalorieAdjustment {
  const { safetyFactor = 0.75, maxDailyIncrease = 500, minWorkoutMinutes = 20 } = config;

  // Calculate total active minutes from workouts
  const totalActiveMinutes = activity.workouts?.reduce((sum, w) => sum + w.durationMinutes, 0) || 0;
  const workoutCount = activity.workouts?.length || 0;

  // Calculate active calories (prefer workout-specific data)
  const activeCalories =
    activity.workouts?.reduce((sum, w) => sum + w.caloriesBurned, 0) ||
    activity.activeCalories ||
    0;

  // Check if minimum workout requirement is met
  const meetsMinimumWorkout = totalActiveMinutes >= minWorkoutMinutes || workoutCount > 0;

  // Calculate adjustment
  let adjustment = 0;
  let reason = '';

  if (!meetsMinimumWorkout && totalActiveMinutes === 0) {
    // No significant activity - no adjustment
    reason = 'No significant activity detected';
  } else {
    // Apply safety factor to active calories
    const rawAdjustment = Math.round(activeCalories * safetyFactor);

    // Cap at maximum daily increase
    adjustment = Math.min(rawAdjustment, maxDailyIncrease);

    if (adjustment > 0) {
      reason = `Added ${adjustment} calories for ${totalActiveMinutes} minutes of activity`;
    } else {
      reason = 'Activity below adjustment threshold';
    }
  }

  return {
    originalTarget: baseTarget,
    newTarget: baseTarget + adjustment,
    adjustment,
    reason,
    activityData: {
      platform: activity.platform,
      activeCalories,
      workoutCount,
      totalActiveMinutes,
    },
    appliedAt: new Date(),
  };
}

/**
 * Calculate meal plan adjustments based on calorie target change
 *
 * Distributes calorie increase across meals proportionally
 */
export function calculateMealPlanAdjustments(
  baseMeals: { slot: string; calories: number }[],
  calorieAdjustment: CalorieAdjustment
): {
  dayNumber: number;
  originalCalories: number;
  adjustedCalories: number;
  adjustmentPercentage: number;
  meals: {
    slot: string;
    originalCalories: number;
    adjustedCalories: number;
  }[];
} {
  const originalCalories = baseMeals.reduce((sum, m) => sum + m.calories, 0);
  const adjustment = calorieAdjustment.adjustment;
  const adjustedCalories = originalCalories + adjustment;
  const adjustmentPercentage = (adjustment / originalCalories) * 100;

  // Distribute adjustment proportionally across meals
  const meals = baseMeals.map((meal) => {
    const mealProportion = meal.calories / originalCalories;
    const mealAdjustment = Math.round(adjustment * mealProportion);
    return {
      slot: meal.slot,
      originalCalories: meal.calories,
      adjustedCalories: meal.calories + mealAdjustment,
    };
  });

  return {
    dayNumber: 1, // Will be set by caller
    originalCalories,
    adjustedCalories,
    adjustmentPercentage,
    meals,
  };
}

/**
 * Validate if adjustment should be applied based on timing
 */
export function shouldApplyAdjustment(
  activityDate: Date,
  currentDate: Date = new Date(),
  windowHours: number = 4
): boolean {
  const timeDiffMs = currentDate.getTime() - activityDate.getTime();
  const windowMs = windowHours * 60 * 60 * 1000;

  // Apply adjustment if activity was within the time window
  return timeDiffMs >= 0 && timeDiffMs <= windowMs;
}

/**
 * Aggregate activity data from multiple platforms for a single date
 */
export function aggregateActivityData(activities: NormalizedActivity[]): NormalizedActivity {
  if (activities.length === 0) {
    throw new Error('No activity data to aggregate');
  }

  // Use the most recent sync as base
  const baseActivity = activities[0];
  const allWorkouts: NormalizedActivity['workouts'] = [];

  // Aggregate all data points
  const aggregated: NormalizedActivity = {
    platform: 'aggregated',
    syncDate: baseActivity.syncDate,
    steps: 0,
    activeCalories: 0,
    totalCalories: 0,
    distanceKm: 0,
    activeMinutes: 0,
    workouts: allWorkouts,
  };

  for (const activity of activities) {
    if (activity.steps) aggregated.steps = (aggregated.steps ?? 0) + activity.steps;
    if (activity.activeCalories)
      aggregated.activeCalories = (aggregated.activeCalories ?? 0) + activity.activeCalories;
    if (activity.totalCalories)
      aggregated.totalCalories = (aggregated.totalCalories ?? 0) + activity.totalCalories;
    if (activity.distanceKm)
      aggregated.distanceKm = (aggregated.distanceKm ?? 0) + activity.distanceKm;
    if (activity.activeMinutes)
      aggregated.activeMinutes = (aggregated.activeMinutes ?? 0) + activity.activeMinutes;
    if (activity.workouts) {
      allWorkouts.push(...activity.workouts);
    }
  }

  // Use the maximum heart rate values
  for (const activity of activities) {
    if (
      activity.heartRateAvg &&
      (!aggregated.heartRateAvg || activity.heartRateAvg > aggregated.heartRateAvg)
    ) {
      aggregated.heartRateAvg = activity.heartRateAvg;
    }
    if (
      activity.heartRateMax &&
      (!aggregated.heartRateMax || activity.heartRateMax > aggregated.heartRateMax)
    ) {
      aggregated.heartRateMax = activity.heartRateMax;
    }
  }

  // Use sleep data from the most detailed source (Oura > Fitbit > Apple Health)
  const sleepPriority = ['oura', 'fitbit', 'apple_health'];
  for (const platform of sleepPriority) {
    const activity = activities.find((a) => a.platform === platform);
    if (activity?.sleepData) {
      aggregated.sleepData = activity.sleepData;
      break;
    }
  }

  return aggregated;
}

/**
 * Calculate adherence-adjusted targets based on recent trends
 *
 * If user consistently exceeds targets, increase them
 * If user consistently falls short, decrease them slightly
 */
export function calculateAdherenceAdjustedTarget(
  currentTarget: number,
  adherenceScores: number[],
  windowSize: number = 7
): number {
  if (adherenceScores.length < windowSize) {
    return currentTarget;
  }

  // Get the last N days of adherence scores
  const recentScores = adherenceScores.slice(-windowSize);
  const avgAdherence = recentScores.reduce((sum, s) => sum + s, 0) / windowSize;

  // Adjust based on adherence trend
  let adjustmentFactor = 1.0;

  if (avgAdherence > 110) {
    // Consistently exceeding targets by >10%
    adjustmentFactor = 1.05; // Increase by 5%
  } else if (avgAdherence > 105) {
    // Consistently exceeding targets by >5%
    adjustmentFactor = 1.02; // Increase by 2%
  } else if (avgAdherence < 80) {
    // Consistently falling short by >20%
    adjustmentFactor = 0.95; // Decrease by 5%
  } else if (avgAdherence < 90) {
    // Consistently falling short by >10%
    adjustmentFactor = 0.98; // Decrease by 2%
  }

  return Math.round(currentTarget * adjustmentFactor);
}

/**
 * Round meal calories to practical values (multiples of 10 or 25)
 */
export function roundMealCalories(calories: number, roundTo: 10 | 25 = 10): number {
  return Math.round(calories / roundTo) * roundTo;
}

/**
 * Calculate macro distribution for adjusted calories
 */
export function calculateAdjustedMacros(
  originalMacros: { protein: number; carbs: number; fat: number },
  originalCalories: number,
  adjustedCalories: number
): { protein: number; carbs: number; fat: number } {
  const adjustmentRatio = adjustedCalories / originalCalories;

  return {
    protein: Math.round(originalMacros.protein * adjustmentRatio),
    carbs: Math.round(originalMacros.carbs * adjustmentRatio),
    fat: Math.round(originalMacros.fat * adjustmentRatio),
  };
}
