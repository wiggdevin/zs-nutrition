// ============================================================
// Fitbit OAuth Callback Handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/fitness/callback/fitbit
 *
 * Handles Fitbit OAuth callback
 * Exchanges authorization code for access token
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in?error=unauthorized', req.url));
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL('/settings?fitness=fitbit&error=oauth_error', req.url),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?fitness=fitbit&error=no_code', req.url),
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code);

    if (!tokenResponse.access_token) {
      return NextResponse.redirect(
        new URL('/settings?fitness=fitbit&error=token_exchange_failed', req.url),
      );
    }

    // Get user profile from Fitbit
    const profileResponse = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const profileData = await profileResponse.json();
    const platformUserId = profileData.user?.encodedId;

    // Store connection in database
    // Note: In production, encrypt tokens before storing
    await prisma.fitnessConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: 'fitbit',
        },
      },
      create: {
        userId,
        platform: 'fitbit',
        accessToken: tokenResponse.access_token, // Should be encrypted
        refreshToken: tokenResponse.refresh_token, // Should be encrypted
        tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        platformUserId,
        scope: tokenResponse.scope,
        isActive: true,
        lastSyncAt: null,
        syncFrequency: 'daily',
        settings: '{}',
      },
      update: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        platformUserId,
        isActive: true,
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?fitness=fitbit&status=connected', req.url),
    );
  } catch (error) {
    logger.error('Error in Fitbit OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?fitness=fitbit&error=server_error', req.url),
    );
  }
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/fitbit`,
      client_id: process.env.FITBIT_CLIENT_ID!,
      expires_in: '31536000', // 1 year
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fitbit token exchange failed: ${errorText}`);
  }

  return await response.json();
}
