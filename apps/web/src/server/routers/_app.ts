import { router } from '../trpc';
import { planRouter } from './plan';
import { mealRouter } from './meal';
import { foodRouter } from './food';
import { trackingRouter } from './tracking';
import { userRouter } from './user';
import { accountRouter } from './account';
import { adaptiveNutritionRouter } from './adaptive-nutrition';

export const appRouter = router({
  plan: planRouter,
  meal: mealRouter,
  food: foodRouter,
  tracking: trackingRouter,
  user: userRouter,
  account: accountRouter,
  adaptiveNutrition: adaptiveNutritionRouter,
});

export type AppRouter = typeof appRouter;
