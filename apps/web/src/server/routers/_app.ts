import { router } from '../trpc'
import { planRouter } from './plan'
import { mealRouter } from './meal'
import { foodRouter } from './food'
import { trackingRouter } from './tracking'
import { userRouter } from './user'
import { adaptiveNutritionRouter } from './adaptive-nutrition'
import { testRouter } from './test'

export const appRouter = router({
  plan: planRouter,
  meal: mealRouter,
  food: foodRouter,
  tracking: trackingRouter,
  user: userRouter,
  adaptiveNutrition: adaptiveNutritionRouter,
  test: testRouter,
})

export type AppRouter = typeof appRouter
