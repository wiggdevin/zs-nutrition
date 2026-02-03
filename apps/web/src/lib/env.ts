import { z } from 'zod';

/**
 * Environment variable validation using Zod.
 *
 * Server-side variables are validated at startup. Client-side variables
 * (NEXT_PUBLIC_*) are validated separately since they're inlined at build time.
 *
 * If any required variable is missing, the app throws a descriptive error
 * listing every missing variable so developers can fix them all at once.
 */

// ---------------------------------------------------------------------------
// Server-side environment schema
// ---------------------------------------------------------------------------
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required — get your Neon connection string from https://console.neon.tech'),

  // Clerk authentication (optional in dev — uses mock auth when empty)
  CLERK_SECRET_KEY: z
    .string()
    .optional()
    .default(''),

  // AI — Anthropic Claude
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .default(''),

  // FatSecret API
  FATSECRET_CLIENT_ID: z
    .string()
    .optional()
    .default(''),
  FATSECRET_CLIENT_SECRET: z
    .string()
    .optional()
    .default(''),

  // Redis
  REDIS_URL: z
    .string()
    .optional()
    .default('redis://localhost:6379'),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z
    .string()
    .optional()
    .default(''),

  // Development helpers
  USE_MOCK_QUEUE: z
    .string()
    .optional()
    .default('true'),

  INTERNAL_API_SECRET: z
    .string()
    .optional()
    .default(''),

  WEB_APP_URL: z
    .string()
    .optional()
    .default('http://localhost:3456'),
});

// ---------------------------------------------------------------------------
// Client-side (public) environment schema
// ---------------------------------------------------------------------------
const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .optional()
    .default(''),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z
    .string()
    .optional()
    .default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z
    .string()
    .optional()
    .default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z
    .string()
    .optional()
    .default('/dashboard'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z
    .string()
    .optional()
    .default('/onboarding'),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  ✗ ${path}: ${issue.message}`;
  });

  return [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║       ❌  MISSING ENVIRONMENT VARIABLES                     ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'The following environment variables are invalid or missing:',
    '',
    ...issues,
    '',
    '💡 Copy .env.example to .env.local and fill in the values:',
    '   cp .env.example apps/web/.env.local',
    '',
    'See the README for setup instructions.',
    '',
  ].join('\n');
}

/**
 * Validates server-side environment variables.
 * Call this at app startup (e.g., in instrumentation.ts or a root layout).
 * Throws with a helpful message listing all missing variables.
 */
export function validateServerEnv() {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error(formatZodError(result.error));
    throw new Error(
      `❌ Invalid server environment variables.\n${formatZodError(result.error)}`
    );
  }

  return result.data;
}

/**
 * Validates client-side (NEXT_PUBLIC_*) environment variables.
 * These are inlined at build time by Next.js.
 */
export function validateClientEnv() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  });

  if (!result.success) {
    console.error(formatZodError(result.error));
    throw new Error(
      `❌ Invalid client environment variables.\n${formatZodError(result.error)}`
    );
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Typed environment access — lazy-validated singleton
// ---------------------------------------------------------------------------

let _serverEnv: z.infer<typeof serverEnvSchema> | null = null;
let _clientEnv: z.infer<typeof clientEnvSchema> | null = null;

/**
 * Type-safe access to server environment variables.
 * Validates on first access, then caches the result.
 *
 * Usage:
 *   import { serverEnv } from '@/lib/env';
 *   const dbUrl = serverEnv().DATABASE_URL;
 */
export function serverEnv() {
  if (!_serverEnv) {
    _serverEnv = validateServerEnv();
  }
  return _serverEnv;
}

/**
 * Type-safe access to client environment variables.
 * Validates on first access, then caches the result.
 *
 * Usage:
 *   import { clientEnv } from '@/lib/env';
 *   const clerkKey = clientEnv().NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
 */
export function clientEnv() {
  if (!_clientEnv) {
    _clientEnv = validateClientEnv();
  }
  return _clientEnv;
}

// Export schemas for external use (e.g., testing)
export { serverEnvSchema, clientEnvSchema };

// Export inferred types
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
