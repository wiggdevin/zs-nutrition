import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import superjson from 'superjson'
import { prisma } from '@/lib/prisma'
import { getClerkUserId } from '@/lib/auth'

export type Context = {
  userId: string | null
  prisma: typeof prisma
}

export async function createContext(): Promise<Context> {
  const userId = await getClerkUserId()
  return {
    userId,
    prisma,
  }
}

/**
 * Format Zod validation errors into user-friendly messages.
 * Each field error is formatted as "fieldName: error message"
 */
function formatZodError(error: ZodError): string {
  const fieldErrors = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'input'
    return `${field}: ${issue.message}`
  })
  return fieldErrors.join('; ')
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: error.cause instanceof ZodError
        ? formatZodError(error.cause)
        : shape.message,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure

// Middleware that enforces authentication
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to access this resource.',
    })
  }

  // Ensure user exists in our database, create if needed
  let user = await ctx.prisma.user.findUnique({
    where: { clerkUserId: ctx.userId },
  })

  if (!user) {
    // Auto-create user record on first authenticated request
    user = await ctx.prisma.user.create({
      data: {
        clerkUserId: ctx.userId,
        email: `${ctx.userId}@clerk.dev`, // placeholder, will be updated
      },
    })
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      dbUserId: user.id,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceAuth)
