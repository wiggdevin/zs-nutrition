import { router } from '../../trpc';
import { mealQueriesRouter } from './queries';
import { mealMutationsRouter } from './mutations';

/**
 * Meal Router — merges query and mutation sub-routers.
 * All procedures remain at the same path to maintain backward compatibility.
 */
export const mealRouter = router({
  // Queries
  getActivePlan: mealQueriesRouter.getActivePlan,
  getTodaysPlanMeals: mealQueriesRouter.getTodaysPlanMeals,
  getTodaysLog: mealQueriesRouter.getTodaysLog,

  // Mutations
  logMealFromPlan: mealMutationsRouter.logMealFromPlan,
  quickAdd: mealMutationsRouter.quickAdd,
  deleteTrackedMeal: mealMutationsRouter.deleteTrackedMeal,
});
