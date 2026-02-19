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
   * Fetch all Oura data for a date range, grouped by day
   */
  async fetchDateRange(startDate: string, endDate: string): Promise<Map<string, OuraDaySyncData>> {
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

    // Log which endpoints succeeded/failed for debugging
    const endpoints = [
      { name: 'daily_activity', result: activity },
      { name: 'daily_sleep', result: sleep },
      { name: 'sleep_periods', result: sleepPeriods },
      { name: 'daily_readiness', result: readiness },
      { name: 'heartrate', result: heartRate },
      { name: 'workouts', result: workouts },
    ];
    for (const ep of endpoints) {
      if (ep.result.status === 'rejected') {
        logger.error(`Oura ${ep.name} FAILED:`, ep.result.reason);
      } else {
        logger.warn(`Oura ${ep.name}: ${ep.result.value.data.length} records`);
      }
    }

    const activityList = activity.status === 'fulfilled' ? activity.value.data : [];
    const sleepList = sleep.status === 'fulfilled' ? sleep.value.data : [];
    const sleepPeriodList = sleepPeriods.status === 'fulfilled' ? sleepPeriods.value.data : [];
    const readinessList = readiness.status === 'fulfilled' ? readiness.value.data : [];
    const heartRateList = heartRate.status === 'fulfilled' ? heartRate.value.data : [];
    const workoutList = workouts.status === 'fulfilled' ? workouts.value.data : [];

    // Collect all unique days from every endpoint
    const allDays = new Set<string>();
    for (const item of activityList) allDays.add(item.day);
    for (const item of sleepList) allDays.add(item.day);
    for (const item of sleepPeriodList) allDays.add(item.day);
    for (const item of readinessList) allDays.add(item.day);
    for (const item of workoutList) allDays.add(item.day);

    // Heart rate samples use timestamp, extract day from it
    for (const sample of heartRateList) {
      allDays.add(sample.timestamp.split('T')[0]);
    }

    // Group data by day
    const result = new Map<string, OuraDaySyncData>();
    for (const day of allDays) {
      result.set(day, {
        activity: activityList.find((a) => a.day === day) ?? null,
        sleep: sleepList.find((s) => s.day === day) ?? null,
        sleepPeriods: sleepPeriodList.filter((s) => s.day === day),
        readiness: readinessList.find((r) => r.day === day) ?? null,
        heartRate: heartRateList.filter((h) => h.timestamp.startsWith(day)),
        workouts: workoutList.filter((w) => w.day === day),
      });
    }

    logger.warn(`Oura fetchDateRange ${startDate}→${endDate}: ${result.size} unique days`);

    return result;
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
          client_id: (process.env.OURA_CLIENT_ID || '').trim(),
          client_secret: (process.env.OURA_CLIENT_SECRET || '').trim(),
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
