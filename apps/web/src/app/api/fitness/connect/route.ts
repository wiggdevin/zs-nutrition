// ============================================================
// Connect Fitness Platform - Initiate OAuth Flow
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/safe-logger';

// OAuth state expiration time in seconds (10 minutes)
const STATE_EXPIRATION_SECONDS = 600;

/**
 * POST /api/fitness/connect
 *
 * Initiates OAuth flow for fitness platform connection
 * Returns OAuth URL to redirect user to
 */
export async function POST(req: NextRequest) {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const body = await req.json();
    const { platform } = body;

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Get OAuth configuration from environment
    const config = getOAuthConfig(platform);
    if (!config) {
      return NextResponse.json({ error: 'Platform not supported' }, { status: 400 });
    }

    // Generate cryptographically secure state ID for CSRF protection
    const stateId = crypto.randomUUID();

    // Store state in Redis with expiration for OAuth callback verification
    try {
      await redis.setex(
        `oauth-state:${stateId}`,
        STATE_EXPIRATION_SECONDS,
        JSON.stringify({
          userId: dbUserId,
          clerkUserId,
          platform,
          createdAt: Date.now(),
        })
      );
    } catch (redisError) {
      logger.error('Failed to store OAuth state in Redis:', redisError);
      return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 });
    }

    // Generate OAuth URL with state parameter
    const oauthUrl = generateOAuthUrl(platform, config, stateId);

    return NextResponse.json({
      oauthUrl,
      stateId,
      platform,
    });
  } catch (error) {
    logger.error('Error initiating fitness platform connection:', error);
    return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 });
  }
}

function getOAuthConfig(platform: string) {
  switch (platform) {
    case 'fitbit':
      return {
        clientId: process.env.FITBIT_CLIENT_ID,
        clientSecret: process.env.FITBIT_CLIENT_SECRET,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/fitbit`,
        scopes: ['activity', 'sleep', 'heartrate', 'profile'],
      };
    case 'oura':
      return {
        clientId: process.env.OURA_CLIENT_ID,
        clientSecret: process.env.OURA_CLIENT_SECRET,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/oura`,
        scopes: ['personal', 'daily', 'heartrate', 'workout'],
      };
    case 'google_fit':
      return {
        clientId: process.env.GOOGLE_FIT_CLIENT_ID,
        clientSecret: process.env.GOOGLE_FIT_CLIENT_SECRET,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3456'}/api/fitness/callback/google-fit`,
        scopes: [
          'https://www.googleapis.com/auth/fitness.activity.read',
          'https://www.googleapis.com/auth/fitness.sleep.read',
          'https://www.googleapis.com/auth/fitness.heart_rate.read',
        ],
      };
    case 'apple_health':
      // Apple HealthKit uses native iOS integration, not OAuth
      return {
        clientId: 'apple_health',
        redirectUri: '',
        scopes: [],
      };
    default:
      return null;
  }
}

function generateOAuthUrl(platform: string, config: any, stateId: string): string {
  switch (platform) {
    case 'fitbit': {
      const fitbitParams = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        expires_in: '604800', // 7 days
        state: stateId,
      });
      return `https://www.fitbit.com/oauth2/authorize?${fitbitParams.toString()}`;
    }

    case 'oura': {
      const ouraParams = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        state: stateId,
      });
      return `https://cloud.ouraring.com/oauth/authorize?${ouraParams.toString()}`;
    }

    case 'google_fit': {
      const googleParams = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: stateId,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`;
    }

    case 'apple_health':
      // Apple HealthKit requires native iOS app integration
      // Return a special URL scheme for iOS app
      return 'zsn-healthkit://auth';

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
