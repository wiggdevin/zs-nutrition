import { z } from 'zod';
import { logger } from './logger.js';

/**
 * Environment variable validation for the queue worker.
 * Validates on first access and throws with a descriptive error
 * if required variables are missing.
 */

const isProduction = process.env.NODE_ENV === 'production';

const workerEnvSchema = z.object({
  // Redis (always required for worker)
  REDIS_URL: z.string().min(1, 'REDIS_URL is required for the queue worker'),

  // AI - Anthropic Claude
  ANTHROPIC_API_KEY: isProduction
    ? z.string().min(1, 'ANTHROPIC_API_KEY is required in production')
    : z.string().optional().default(''),

  // USDA FoodData Central (required — primary nutrition source)
  USDA_API_KEY: isProduction
    ? z.string().min(1, 'USDA_API_KEY is required in production')
    : z.string().optional().default(''),

  // Database (optional — enables LocalUSDAAdapter for sub-ms food lookups)
  DATABASE_URL: z.string().optional().default(''),

  // FatSecret API (optional — fallback nutrition source)
  FATSECRET_CLIENT_ID: z.string().optional().default(''),
  FATSECRET_CLIENT_SECRET: z.string().optional().default(''),

  // Web app callback
  WEB_APP_URL: z.string().optional().default('http://localhost:3456'),
  INTERNAL_API_SECRET: isProduction
    ? z.string().min(20, 'INTERNAL_API_SECRET must be at least 20 characters in production')
    : z.string().optional().default(''),

  // FatSecret proxy (optional)
  FATSECRET_PROXY_SECRET: z.string().optional().default(''),
});

let _workerEnv: z.infer<typeof workerEnvSchema> | null = null;

/**
 * Type-safe access to worker environment variables.
 * Validates on first access, then caches the result.
 */
export function workerEnv() {
  if (!_workerEnv) {
    const result = workerEnvSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      logger.error('Missing worker environment variables', { issues });
      throw new Error(`Invalid worker environment variables.\n${issues}`);
    }
    _workerEnv = result.data;
  }
  return _workerEnv;
}

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
