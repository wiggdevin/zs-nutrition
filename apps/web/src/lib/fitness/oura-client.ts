// ============================================================
// Oura Ring API v2 Client
// ============================================================

import { decrypt, encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/safe-logger';
import type {
  OuraListResponse,
  OuraDailyActivity,
  OuraDailySleep,
  OuraSleepPeriod,
  OuraDailyReadiness,
  OuraHeartRateSample,
  OuraWorkout,
  OuraDaySyncData,
} from './oura-types';

const OURA_API_BASE = 'https://api.ouraring.com/v2';

interface OuraClientOptions {
  connectionId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
}

export class OuraApiClient {
  private accessToken: string;
  private connectionId: string;
  private encryptedRefreshToken: string | null;

  constructor(options: OuraClientOptions) {
    this.accessToken = decrypt(options.encryptedAccessToken);
    this.connectionId = options.connectionId;
    this.encryptedRefreshToken = options.encryptedRefreshToken;
  }

  /**
   * Fetch all Oura data for a date range
   */
  async fetchDayData(startDate: string, endDate: string): Promise<OuraDaySyncData> {
    const params = `start_date=${startDate}&end_date=${endDate}`;

    // Fetch all endpoints in parallel
    const [activity, sleep, sleepPeriods, readiness, heartRate, workouts] =
      await Promise.allSettled([
        this.get<OuraListResponse<OuraDailyActivity>>(`/usercollection/daily_activity?${params}`),
        this.get<OuraListResponse<OuraDailySleep>>(`/usercollection/daily_sleep?${params}`),
        this.get<OuraListResponse<OuraSleepPeriod>>(`/usercollection/sleep?${params}`),
        this.get<OuraListResponse<OuraDailyReadiness>>(`/usercollection/daily_readiness?${params}`),
        this.get<OuraListResponse<OuraHeartRateSample>>(`/usercollection/heartrate?${params}`),
        this.get<OuraListResponse<OuraWorkout>>(`/usercollection/workout?${params}`),
      ]);

    return {
      activity: activity.status === 'fulfilled' ? (activity.value.data[0] ?? null) : null,
      sleep:
        activity.status === 'fulfilled'
          ? sleep.status === 'fulfilled'
            ? (sleep.value.data[0] ?? null)
            : null
          : null,
      sleepPeriods: sleepPeriods.status === 'fulfilled' ? sleepPeriods.value.data : [],
      readiness: readiness.status === 'fulfilled' ? (readiness.value.data[0] ?? null) : null,
      heartRate: heartRate.status === 'fulfilled' ? heartRate.value.data : [],
      workouts: workouts.status === 'fulfilled' ? workouts.value.data : [],
    };
  }

  /**
   * Make an authenticated GET request to Oura API with retry on 401
   */
  private async get<T>(path: string): Promise<T> {
    let response = await fetch(`${OURA_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    // If 401, try to refresh the token once
    if (response.status === 401 && this.encryptedRefreshToken) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        response = await fetch(`${OURA_API_BASE}${path}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Oura API ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Refresh the access token and persist both new tokens
   */
  private async refreshToken(): Promise<boolean> {
    if (!this.encryptedRefreshToken) return false;

    try {
      const refreshToken = decrypt(this.encryptedRefreshToken);

      const response = await fetch('https://api.ouraring.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.OURA_CLIENT_ID!,
          client_secret: process.env.OURA_CLIENT_SECRET!,
        }).toString(),
      });

      if (!response.ok) {
        logger.error('Oura token refresh failed:', response.status);
        // Mark connection as inactive on auth failure
        await prisma.fitnessConnection.update({
          where: { id: this.connectionId },
          data: { isActive: false },
        });
        return false;
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Encrypt and persist both new tokens (refresh tokens are single-use)
      const encryptedAccess = encrypt(data.access_token);
      const encryptedRefresh = data.refresh_token ? encrypt(data.refresh_token) : null;
      this.encryptedRefreshToken = encryptedRefresh;

      await prisma.fitnessConnection.update({
        where: { id: this.connectionId },
        data: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        },
      });

      return true;
    } catch (error) {
      logger.error('Error refreshing Oura token:', error);
      return false;
    }
  }
}
