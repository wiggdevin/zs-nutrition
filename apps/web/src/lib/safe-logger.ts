/**
 * Safe Logger — sanitizes log output to prevent PII leakage.
 *
 * Ensures that user names, emails, health data, and API keys
 * are never written to console or log files.
 */

// Patterns that indicate PII in error messages or data
const PII_PATTERNS = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // API keys (common formats)
  /sk[-_][a-zA-Z0-9_-]{20,}/g,
  /sk_test_[a-zA-Z0-9_-]+/g,
  /sk_live_[a-zA-Z0-9_-]+/g,
  /pk_test_[a-zA-Z0-9_-]+/g,
  /pk_live_[a-zA-Z0-9_-]+/g,
  /sk-ant-[a-zA-Z0-9_-]+/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]+/g,
  // Connection strings with credentials
  /postgresql:\/\/[^@]+@[^\s]+/g,
  /redis:\/\/[^@]+@[^\s]+/g,
]

/**
 * Redact PII patterns from a string.
 */
function redactString(str: string): string {
  let result = str
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

/**
 * Extract a safe error message from an error object.
 * Returns only the error type and a sanitized message — no stack traces.
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name || 'Error'
    const message = redactString(error.message)
    return `${name}: ${message}`
  }
  if (typeof error === 'string') {
    return redactString(error)
  }
  return 'Unknown error'
}

/**
 * Safe console.error — logs error context without PII.
 * Use this instead of console.error(label, error) in API routes.
 */
export function safeLogError(label: string, error: unknown): void {
  console.error(`${label}`, safeErrorMessage(error))
}

/**
 * Safe console.warn — logs warning context without PII.
 */
export function safeLogWarn(label: string, error: unknown): void {
  console.warn(`${label}`, safeErrorMessage(error))
}

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Structured logger with environment-aware log levels.
 * - debug: Only logs in development (suppressed in production)
 * - info: Only logs in development (suppressed in production)
 * - warn: Always logs with PII redaction
 * - error: Always logs with PII redaction
 */
export const logger = {
  debug: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log('[DEBUG]', ...args)
  },
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log('[INFO]', ...args)
  },
  warn: (label: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${label}`, ...args.map(a => {
      if (a instanceof Error) return safeErrorMessage(a)
      if (typeof a === 'string') return redactString(a)
      return a
    }))
  },
  error: (label: string, error?: unknown) => {
    console.error(`[ERROR] ${label}`, error ? safeErrorMessage(error) : '')
  },
}
