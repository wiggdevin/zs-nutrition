import { PrismaClient } from '@prisma/client';

// DATABASE_URL should include these Neon/pgbouncer params:
//   ?pgbouncer=true&connection_limit=5&connect_timeout=15
// pgbouncer=true   → use Neon's connection pooler
// connection_limit → cap per-instance pool size (Vercel spins many isolates)
// connect_timeout  → fail fast on cold-start instead of hanging

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
