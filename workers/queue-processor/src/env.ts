import { z } from 'zod';

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

  // FatSecret API
  FATSECRET_CLIENT_ID: isProduction
    ? z.string().min(1, 'FATSECRET_CLIENT_ID is required in production')
    : z.string().optional().default(''),
  FATSECRET_CLIENT_SECRET: isProduction
    ? z.string().min(1, 'FATSECRET_CLIENT_SECRET is required in production')
    : z.string().optional().default(''),

  // USDA FoodData Central (optional fallback)
  USDA_API_KEY: z.string().optional().default(''),

  // Web app callback
  WEB_APP_URL: z.string().optional().default('http://localhost:3456'),
  INTERNAL_API_SECRET: isProduction
    ? z.string().min(20, 'INTERNAL_API_SECRET must be at least 20 characters in production')
    : z.string().optional().default('dev-internal-secret'),

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
      console.error(`\nMissing worker environment variables:\n${issues}\n`);
      throw new Error(`Invalid worker environment variables.\n${issues}`);
    }
    _workerEnv = result.data;
  }
  return _workerEnv;
}

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
