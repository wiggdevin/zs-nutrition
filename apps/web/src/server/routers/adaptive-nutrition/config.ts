/**
 * Configuration constants for adaptive nutrition calculations.
 * Shared across all adaptive-nutrition sub-routers.
 */
export const ADAPTIVE_NUTRITION_CONFIG = {
  /** Minimum extra calories burned to trigger daily target adjustment */
  MIN_ACTIVITY_THRESHOLD_KCAL: 200,
  /** Rate at which activity calories are added back (50% = conservative replenishment) */
  ACTIVITY_REPLENISHMENT_RATE: 0.5,
  /** Weekly weight loss threshold below which plateau is detected (lbs/week) */
  PLATEAU_THRESHOLD_LBS_PER_WEEK: 0.3,
  /** Calorie targets are rounded to this factor for cleaner numbers */
  CALORIE_ROUNDING_FACTOR: 50,
  /** Safe calorie bounds relative to BMR */
  SAFE_BOUNDS: {
    MIN_ABOVE_BMR: 200,
    MAX_ABOVE_BMR: 1500,
  },
  /** Calorie adjustment multipliers per lb/week deviation */
  ADJUSTMENT_MULTIPLIERS: {
    CUT_DECREASE_PER_LB: 100,
    BULK_INCREASE_PER_LB: 150,
    BULK_DECREASE_PER_LB: 100,
  },
} as const;
