/**
 * Query Cache Configuration
 *
 * Centralized staleTime configurations for tRPC queries.
 * These values determine how long data is considered "fresh" before
 * React Query will refetch in the background.
 *
 * Guidelines:
 * - Static data (rarely changes): longer staleTime
 * - Dynamic data (changes frequently): shorter staleTime or rely on mutations to invalidate
 * - User-specific data that changes with actions: invalidate via mutation onSuccess
 */

/**
 * Cache times in milliseconds
 */
export const CACHE_TIMES = {
  /**
   * Food search results - nutritional data from FatSecret rarely changes.
   * 1 hour cache is safe for API data like food nutrition info.
   */
  FOOD_SEARCH: 60 * 60 * 1000, // 1 hour

  /**
   * Active plan - the user's current meal plan. Only changes when they
   * generate a new plan or make swaps. Safe to cache for several minutes.
   */
  ACTIVE_PLAN: 5 * 60 * 1000, // 5 minutes

  /**
   * Today's meals - updates more frequently as user logs meals.
   * Use shorter cache but rely on mutation invalidation for real-time updates.
   */
  TODAYS_MEALS: 30 * 1000, // 30 seconds

  /**
   * User profile - rarely changes, only when user updates settings.
   */
  USER_PROFILE: 10 * 60 * 1000, // 10 minutes

  /**
   * Weight/trend data - user logs weights weekly typically.
   * Safe to cache for a few minutes.
   */
  WEIGHT_HISTORY: 5 * 60 * 1000, // 5 minutes

  /**
   * Calorie adjustment suggestions - computed from weight trends.
   * Cache briefly but refresh periodically.
   */
  CALORIE_SUGGESTIONS: 60 * 1000, // 1 minute

  /**
   * Grocery list - changes when plan changes or user checks items off.
   * Moderate caching is okay since we invalidate on mutations.
   */
  GROCERY_LIST: 2 * 60 * 1000, // 2 minutes

  /**
   * Daily tracking summary - changes as user logs meals.
   * Short cache but rely on mutation invalidation.
   */
  DAILY_SUMMARY: 30 * 1000, // 30 seconds

  /**
   * Weekly trend analysis - computed data, safe to cache.
   */
  WEEKLY_TREND: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Query configuration presets for common use cases
 */
export const QUERY_OPTIONS = {
  /**
   * For data that almost never changes (e.g., food nutrition info from external APIs)
   */
  longLivedStatic: {
    staleTime: CACHE_TIMES.FOOD_SEARCH,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },

  /**
   * For user data that changes occasionally via explicit actions
   */
  userConfigurable: {
    staleTime: CACHE_TIMES.USER_PROFILE,
    refetchOnWindowFocus: false,
  },

  /**
   * For data that updates throughout the day as user takes actions
   */
  frequentlyUpdated: {
    staleTime: CACHE_TIMES.TODAYS_MEALS,
    refetchOnWindowFocus: true,
  },

  /**
   * For computed/analytics data
   */
  analytics: {
    staleTime: CACHE_TIMES.WEEKLY_TREND,
    refetchOnWindowFocus: false,
  },
} as const;
