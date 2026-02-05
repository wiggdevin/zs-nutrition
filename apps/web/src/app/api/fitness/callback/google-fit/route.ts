// ============================================================
// Google Fit OAuth Callback Handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/fitness/callback/google-fit
 *
 * Handles Google Fit OAuth callback
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
        new URL('/settings?fitness=google_fit&error=oauth_error', req.url),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=no_code', req.url),
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code);

    if (!tokenResponse.access_token) {
      return NextResponse.redirect(
        new URL('/settings?fitness=google_fit&error=token_exchange_failed', req.url),
      );
    }

    // Get user profile from Google
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      },
    );

    const profileData = await profileResponse.json();
    const platformUserId = profileData.id;

    // Store connection in database
    await prisma.fitnessConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: 'google_fit',
        },
      },
      create: {
        userId,
        platform: 'google_fit',
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
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
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        platformUserId,
        isActive: true,
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?fitness=google_fit&status=connected', req.url),
    );
  } catch (error) {
    logger.error('Error in Google Fit OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?fitness=google_fit&error=server_error', req.url),
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
