import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';

const startTime = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  // Check database
  let dbStatus: 'ok' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch {
    dbStatus = 'down';
  }

  // Check Redis (optional service)
  let redisStatus: 'ok' | 'down' | 'not_configured' = 'not_configured';
  if (process.env.REDIS_URL) {
    redisStatus = (await checkRedisHealth()) ? 'ok' : 'down';
  }

  // Pipeline readiness: check that critical env vars exist (not their values)
  const redisUrl = process.env.REDIS_URL || '';
  const pipeline = {
    redisConfigured: !!process.env.REDIS_URL,
    redisTls: redisUrl.startsWith('rediss://'),
    internalApiSecret: !!process.env.INTERNAL_API_SECRET,
    anthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
  };

  const overallStatus = dbStatus === 'ok' ? 'ok' : 'degraded';
  const httpStatus = dbStatus === 'ok' ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      uptime: uptimeSeconds,
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      pipeline,
    },
    { status: httpStatus }
  );
}
