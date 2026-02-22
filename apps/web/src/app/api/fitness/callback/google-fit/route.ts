// ============================================================
// Google Fit OAuth Callback Handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { encrypt } from '@/lib/encryption';
import { logger } from '@/lib/safe-logger';

interface StoredOAuthState {
  userId: string;
  clerkUserId: string;
  platform: string;
  createdAt: number;
}

/**
 * GET /api/fitness/callback/google-fit
 *
 * Handles Google Fit OAuth callback
 * Exchanges authorization code for access token
 */
export async function GET(req: NextRequest) {
  try {
    let dbUserId: string;
    let clerkUserId: string;
    try {
      const result = await requireActiveUser();
      dbUserId = result.dbUserId;
      clerkUserId = result.clerkUserId;
    } catch {
      return NextResponse.redirect(new URL('/sign-in?error=unauthorized', req.url));
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Validate state parameter for CSRF protection
    if (!state) {
      logger.warn('Google Fit OAuth callback: Missing state parameter');
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=missing_state', req.url)
      );
    }

    // Retrieve and validate stored state from Redis
    let storedState: StoredOAuthState | null = null;
    try {
      const storedStateRaw = await redis.get(`oauth-state:${state}`);
      if (!storedStateRaw) {
        logger.warn('Google Fit OAuth callback: Invalid or expired state');
        return NextResponse.redirect(
          new URL('/settings?fitness=google_fit&error=invalid_state', req.url)
        );
      }
      storedState = JSON.parse(storedStateRaw as string) as StoredOAuthState;
    } catch (redisError) {
      logger.error('Google Fit OAuth callback: Redis error', redisError);
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=server_error', req.url)
      );
    }

    // Verify the state belongs to the current user (CSRF check)
    if (storedState.clerkUserId !== clerkUserId) {
      logger.warn('Google Fit OAuth callback: State user mismatch', {
        stateUserId: storedState.clerkUserId,
        currentUserId: clerkUserId,
      });
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=state_mismatch', req.url)
      );
    }

    // Verify the platform matches
    if (storedState.platform !== 'google_fit') {
      logger.warn('Google Fit OAuth callback: Platform mismatch in state');
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=platform_mismatch', req.url)
      );
    }

    // Delete the state immediately (one-time use to prevent replay attacks)
    try {
      await redis.del(`oauth-state:${state}`);
    } catch (deleteError) {
      // Log but don't fail the request - state will expire anyway
      logger.warn('Failed to delete OAuth state from Redis', deleteError);
    }

    if (error) {
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=oauth_error', req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?fitness=google_fit&error=no_code', req.url));
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code);

    if (!tokenResponse.access_token) {
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=token_exchange_failed', req.url)
      );
    }

    // Get user profile from Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const profileData = await profileResponse.json();
    const platformUserId = profileData.id;

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encrypt(tokenResponse.refresh_token)
      : null;

    // Store connection in database with encrypted tokens
    await prisma.fitnessConnection.upsert({
      where: {
        userId_platform: {
          userId: dbUserId,
          platform: 'google_fit',
        },
      },
      create: {
        userId: dbUserId,
        platform: 'google_fit',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        platformUserId,
        scope: tokenResponse.scope,
        isActive: true,
        lastSyncAt: null,
        syncFrequency: 'daily',
        settings: '{}',
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        platformUserId,
        isActive: true,
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(new URL('/settings?fitness=google_fit&status=connected', req.url));
  } catch (error) {
    logger.error('Error in Google Fit OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?fitness=google_fit&error=server_error', req.url)
    );
  }
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/google-fit`,
      grant_type: 'authorization_code',
      access_type: 'offline',
      prompt: 'consent',
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Fit token exchange failed: ${errorText}`);
  }

  return await response.json();
}
