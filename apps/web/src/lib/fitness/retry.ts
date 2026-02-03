// ============================================================
// Error Handling and Retry Logic for Fitness Platform APIs
// ============================================================

export class FitnessApiError extends Error {
  constructor(
    public platform: string,
    public statusCode: number,
    public errorCode?: string,
    message: string,
  ) {
    super(message);
    this.name = 'FitnessApiError';
  }
}

export class RateLimitError extends FitnessApiError {
  constructor(platform: string, retryAfter?: number) {
    super(platform, 429, 'RATE_LIMIT', 'Rate limit exceeded');
    this.retryAfter = retryAfter;
  }

  retryAfter?: number;
}

export class AuthenticationError extends FitnessApiError {
  constructor(platform: string) {
    super(platform, 401, 'AUTH_FAILED', 'Authentication failed');
  }
}

export class TokenExpiredError extends FitnessApiError {
  constructor(platform: string) {
    super(platform, 401, 'TOKEN_EXPIRED', 'Access token expired');
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [429, 500, 502, 503, 504],
};

/**
 * Execute an async function with exponential backoff retry
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const statusCode = (error as any)?.statusCode;
      const isRetryable = statusCode
        ? config.retryableErrors.includes(statusCode)
        : false;

      if (!isRetryable || attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const currentDelay = Math.min(delay, config.maxDelayMs);

      console.log(
        `Retry attempt ${attempt + 1}/${config.maxRetries} after ${currentDelay}ms`,
      );

      await sleep(currentDelay);
      delay *= config.backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a fetch call with error handling and retry logic
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config?: RetryConfig,
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);

    // Handle specific error statuses
    if (response.status === 401) {
      throw new TokenExpiredError('Unknown');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        'Unknown',
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }

    if (!response.ok && config?.retryableErrors.includes(response.status)) {
      throw new FitnessApiError(
        'Unknown',
        response.status,
        undefined,
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response;
  }, config);
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  platform: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn?: number }> {
  switch (platform) {
    case 'fitbit':
      return await refreshFitbitToken(refreshToken);

    case 'oura':
      return await refreshOuraToken(refreshToken);

    case 'google_fit':
      return await refreshGoogleFitToken(refreshToken);

    default:
      throw new Error(`Token refresh not supported for platform: ${platform}`);
  }
}

/**
 * Refresh Fitbit access token
 */
async function refreshFitbitToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      expires_in: '31536000', // 1 year
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Fitbit token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Oura access token
 */
async function refreshOuraToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Oura token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Google Fit access token
 */
async function refreshGoogleFitToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Google Fit token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Log sync error for monitoring
 */
export function logSyncError(
  userId: string,
  platform: string,
  error: Error,
  context?: Record<string, any>,
): void {
  console.error({
    type: 'fitness_sync_error',
    userId,
    platform,
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if an error indicates the connection should be disabled
 */
export function shouldDisableConnection(error: Error): boolean {
  if (error instanceof TokenExpiredError && !isRefreshable(error)) {
    return true;
  }

  if (error instanceof AuthenticationError) {
    return true;
  }

  return false;
}

/**
 * Check if a token error is refreshable
 */
function isRefreshable(error: TokenExpiredError): boolean {
  // Check if we have the necessary credentials to refresh
  switch (error.platform) {
    case 'fitbit':
      return !!(
        process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET
      );
    case 'oura':
      return !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET);
    case 'google_fit':
      return !!(
        process.env.GOOGLE_FIT_CLIENT_ID && process.env.GOOGLE_FIT_CLIENT_SECRET
      );
    default:
      return false;
  }
}
