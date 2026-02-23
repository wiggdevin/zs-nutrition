export type ErrorSeverity = 'warn' | 'error';

interface LogErrorOptions {
  severity?: ErrorSeverity;
  context?: string;
  rethrow?: boolean;
}

export function logError(
  error: unknown,
  { severity = 'error', context = 'Unknown', rethrow = false }: LogErrorOptions = {}
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const logMessage = `[${context}] ${message}`;

  if (severity === 'warn') {
    console.warn(logMessage, stack);
  } else {
    console.error(logMessage, stack);
  }

  if (rethrow) {
    throw error;
  }
}

export async function tryCatch<T>(
  fn: () => Promise<T>,
  { severity = 'warn', context = 'Unknown', fallback }: LogErrorOptions & { fallback?: T } = {}
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError(error, { severity, context });
    return fallback;
  }
}
