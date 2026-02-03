import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()
