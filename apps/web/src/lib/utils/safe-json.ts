import { z } from 'zod'
import { logger } from '@/lib/safe-logger'

/**
 * Parse a JSON string and validate against a Zod schema.
 * Returns the validated, typed result using the schema's **output** type.
 * Falls back to the provided default on any error (malformed JSON or schema mismatch).
 *
 * Uses `safeParse` so validation errors never throw -- they return the fallback.
 */
export function safeJsonParse<O>(
  json: string | null | undefined,
  schema: z.ZodType<O, z.ZodTypeDef, unknown>,
  fallback: NoInfer<O>
): O {
  if (!json) return fallback

  try {
    const parsed = JSON.parse(json)
    const result = schema.safeParse(parsed)
    if (result.success) return result.data
    logger.warn('[safeJsonParse] Validation failed:', result.error.issues.slice(0, 3))
    return fallback
  } catch {
    logger.warn('[safeJsonParse] JSON.parse failed for input of length', json.length)
    return fallback
  }
}
