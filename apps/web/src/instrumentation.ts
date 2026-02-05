/**
 * Next.js Instrumentation — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Used here to validate environment variables at startup so developers
 * get a clear error message immediately instead of cryptic runtime failures.
 */
import { logger } from '@/lib/safe-logger';

export async function register() {
  // Only validate on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    const { validateServerEnv } = await import('@/lib/env');

    try {
      const env = validateServerEnv();
      logger.info('Environment variables validated successfully');

      // Log which optional services are configured (without exposing secrets)
      const services = {
        Database:
          !!env.DATABASE_URL && env.DATABASE_URL !== 'postgresql://user:password@host:5432/dbname',
        Clerk: !!env.CLERK_SECRET_KEY,
        Anthropic: !!env.ANTHROPIC_API_KEY,
        FatSecret: !!env.FATSECRET_CLIENT_ID && !!env.FATSECRET_CLIENT_SECRET,
        Redis: !!env.REDIS_URL && env.REDIS_URL !== 'redis://localhost:6379',
        'Vercel Blob': !!env.BLOB_READ_WRITE_TOKEN,
        'Mock Queue': env.USE_MOCK_QUEUE === 'true',
      };

      const configured = Object.entries(services)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const notConfigured = Object.entries(services)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (configured.length > 0) {
        logger.info(`  Configured: ${configured.join(', ')}`);
      }
      if (notConfigured.length > 0) {
        logger.info(`  Not configured: ${notConfigured.join(', ')}`);
      }
    } catch (error) {
      // In development, log the error but don't crash so devs can fix incrementally
      if (process.env.NODE_ENV === 'development') {
        logger.error(
          'Environment validation failed:',
          error instanceof Error ? error.message : error
        );
        logger.warn('Continuing in development mode with missing env vars...');
      } else {
        // In production, fail hard — missing env vars will cause runtime errors
        throw error;
      }
    }
  }
}
