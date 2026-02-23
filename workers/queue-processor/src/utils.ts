/**
 * Extract safe error message without PII or secrets.
 *
 * Redacts:
 * - Email addresses
 * - API keys (Anthropic, Clerk, etc.)
 * - Bearer tokens
 * - Database and Redis URLs
 * - Local file paths
 */
export function safeError(error: unknown): string {
  if (!error) return 'Unknown error';
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[API_KEY_REDACTED]')
    .replace(/sk_(test|live)_[a-zA-Z0-9]+/g, '[CLERK_KEY_REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN_REDACTED]')
    .replace(/postgresql:\/\/[^\s"']+/g, '[DB_URL_REDACTED]')
    .replace(/rediss?:\/\/[^\s"']+/g, '[REDIS_URL_REDACTED]')
    .replace(/\/Users\/[^\s"']+/g, '[PATH_REDACTED]');
}
