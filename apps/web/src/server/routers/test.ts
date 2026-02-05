import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const testRouter = router({
  // Public test procedure - no auth required
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.name ?? 'World'}!`,
        timestamp: new Date().toISOString(),
      }
    }),

  // Protected test procedure - requires auth
  protectedHello: protectedProcedure.query(({ ctx }) => {
    return {
      greeting: `Hello from protected route!`,
      userId: ctx.userId,
      dbUserId: ctx.dbUserId,
      timestamp: new Date().toISOString(),
    }
  }),
})
