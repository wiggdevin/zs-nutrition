// ============================================================
// Oura OAuth Callback Handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';

/**
 * GET /api/fitness/callback/oura
 *
 * Handles Oura OAuth callback
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
        new URL('/settings?fitness=oura&error=oauth_error', req.url),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?fitness=oura&error=no_code', req.url),
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code);

    if (!tokenResponse.access_token) {
      return NextResponse.redirect(
        new URL('/settings?fitness=oura&error=token_exchange_failed', req.url),
      );
    }

    // Get user profile from Oura
    const profileResponse = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const profileData = await profileResponse.json();
    const platformUserId = profileData.data?.email;

    // Store connection in database
    await prisma.fitnessConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: 'oura',
        },
      },
      create: {
        userId,
        platform: 'oura',
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
      new URL('/settings?fitness=oura&status=connected', req.url),
    );
  } catch (error) {
    logger.error('Error in Oura OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?fitness=oura&error=server_error', req.url),
    );
  }
}

async function exchangeCodeForToken(code: string) {
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/oura`,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Oura token exchange failed: ${errorText}`);
  }

  return await response.json();
}
