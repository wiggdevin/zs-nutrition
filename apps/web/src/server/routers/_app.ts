import { router } from '../trpc'
import { planRouter } from './plan'
import { mealRouter } from './meal'
import { foodRouter } from './food'
import { trackingRouter } from './tracking'
import { userRouter } from './user'

export const appRouter = router({
  plan: planRouter,
  meal: mealRouter,
  food: foodRouter,
  tracking: trackingRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter
