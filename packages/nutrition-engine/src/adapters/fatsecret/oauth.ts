/**
 * FatSecret OAuth token management
 * Handles authentication with retry logic and token caching.
 */

import { engineLogger } from '../../utils/logger';
import type { FatSecretTokenResponse } from './types';

export class OAuthManager {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://oauth.fatsecret.com/connect/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          },
          body: 'grant_type=client_credentials&scope=basic',
        });

        if (!response.ok) {
          throw new Error(`FatSecret auth failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as FatSecretTokenResponse;
        this.accessToken = data.access_token;
        // Expire 60s early to avoid edge cases
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken!;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 1000;
          engineLogger.warn(
            `[FatSecret] Auth error on attempt ${attempt + 1}, retrying in ${delay}ms: ${(error as Error).message}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('FatSecret auth failed after retries');
  }
}

/**
 * Make an authenticated API request to FatSecret with retry logic.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  timeoutMs = 10000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000 + Math.random() * 500;

          if (attempt < maxRetries) {
            engineLogger.warn(
              `[FatSecret] ${response.status} on attempt ${attempt + 1}, retrying in ${Math.round(delay)}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        return response;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        engineLogger.warn(
          `[FatSecret] Network error on attempt ${attempt + 1}, retrying in ${delay}ms: ${(error as Error).message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('FatSecret API request failed after retries');
}

/**
 * Make an authenticated API request to FatSecret platform.
 */
export async function apiRequest(
  oauth: OAuthManager,
  method: string,
  params: Record<string, string>
): Promise<any> {
  const token = await oauth.authenticate();
  const url = new URL('https://platform.fatsecret.com/rest/server.api');
  url.searchParams.set('method', method);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`FatSecret API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
