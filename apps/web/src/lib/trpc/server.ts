import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import superjson from 'superjson'
import { prisma } from '@/lib/db'

export const createTRPCContext = async () => {
  let clerkUserId: string | null = null
  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch {
    // Auth not available (e.g. during build)
  }
  return { prisma, clerkUserId }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

// Middleware that ensures user is authenticated and has a DB user record
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }

  // Find or create user in our DB
  let user = await ctx.prisma.user.findUnique({
    where: { clerkUserId: ctx.clerkUserId },
  })

  if (!user) {
    user = await ctx.prisma.user.create({
      data: {
        clerkUserId: ctx.clerkUserId,
        email: `${ctx.clerkUserId}@placeholder.com`,
      },
    })
  }

  return next({
    ctx: {
      ...ctx,
      userId: user.id,
      clerkUserId: ctx.clerkUserId,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
