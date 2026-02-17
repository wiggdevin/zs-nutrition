import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const APP_VERSION = process.env.npm_package_version || '0.1.0';

type HealthStatus = 'ok' | 'degraded' | 'error';

interface HealthResponse {
  status: HealthStatus;
  db: boolean;
  redis: boolean;
  timestamp: string;
  version: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    return await checkRedisHealth();
  } catch {
    return false;
  }
}

export async function GET() {
  const [dbHealthy, redisHealthy] = await withTimeout(
    Promise.all([checkDatabase(), checkRedis()]),
    HEALTH_CHECK_TIMEOUT_MS,
    [false, false]
  );

  let status: HealthStatus;
  if (dbHealthy && redisHealthy) {
    status = 'ok';
  } else if (dbHealthy) {
    status = 'degraded';
  } else {
    status = 'error';
  }

  const response: HealthResponse = {
    status,
    db: dbHealthy,
    redis: redisHealthy,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  };

  return NextResponse.json(response, {
    status: status === 'error' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
