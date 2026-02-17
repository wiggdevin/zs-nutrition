/**
 * Error Sanitizer (P4-T07)
 * Maps internal errors to user-friendly messages.
 * All errors pass through this before reaching SSE/polling responses.
 */

/** Known error categories for pattern matching */
const ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  // Zod validation errors
  {
    pattern: /ZodError|Zod.*validation|invalid.*input|parse.*fail/i,
    message: 'Invalid input data. Please check your profile and try again.',
  },
  // Anthropic / Claude errors
  {
    pattern: /anthropic|claude|api_error.*anthropic|overloaded|rate_limit/i,
    message: 'AI service is temporarily unavailable. Please try again in a few minutes.',
  },
  // FatSecret API errors
  {
    pattern: /fatsecret|food.*search.*fail|recipe.*search.*fail|circuit.*breaker.*open/i,
    message: 'Nutrition data service is temporarily unavailable. Please try again shortly.',
  },
  // Puppeteer / PDF errors
  {
    pattern: /puppeteer|chromium|browser.*launch|pdf.*generat|page.*render/i,
    message: 'PDF generation failed. Your meal plan data is still available.',
  },
  // Constraint compatibility
  {
    pattern: /constraints.*incompatible|incompatible.*diet/i,
    message: 'Your dietary preferences have conflicting constraints. Please adjust your settings.',
  },
  // Timeout errors
  {
    pattern: /timeout|timed?\s*out|ETIMEDOUT|ECONNRESET/i,
    message: 'The request took too long. Please try again.',
  },
  // Network errors
  {
    pattern: /ECONNREFUSED|ENOTFOUND|network|fetch.*fail/i,
    message: 'A network error occurred. Please check your connection and try again.',
  },
];

/**
 * Sanitize an error for user-facing display.
 * Maps known error types to friendly messages, strips internal details.
 */
export function sanitizeError(error: unknown): string {
  const rawMessage = extractMessage(error);

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(rawMessage)) {
      return message;
    }
  }

  return 'An unexpected error occurred during meal plan generation. Please try again.';
}

/** Extract a string message from any error type */
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    // Include the error name for better pattern matching (e.g. "ZodError: ...")
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
