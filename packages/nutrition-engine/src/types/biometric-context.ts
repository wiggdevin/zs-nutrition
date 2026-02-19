// ============================================================
// Biometric Context - Aggregated biometric signals for nutrition engine
// ============================================================

export type SleepQuality = 'excellent' | 'good' | 'fair' | 'poor';
export type StressLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type RecoveryState = 'recovered' | 'adequate' | 'compromised' | 'depleted';

export interface BiometricContext {
  /** Whether sufficient data exists (7+ days) to make adjustments */
  dataAvailable: boolean;

  /** Readiness score from wearable (0-100) */
  readinessScore: number | null;

  /** Classified recovery state */
  recoveryState: RecoveryState;

  /** Sleep data */
  sleep: {
    quality: SleepQuality;
    score: number | null;
    totalMinutes: number | null;
    deepMinutes: number | null;
    remMinutes: number | null;
    efficiency: number | null;
    bedtimeStart: string | null; // ISO time
    bedtimeEnd: string | null;
  };

  /** HRV and stress */
  hrv: {
    current: number | null; // ms
    sevenDayAvg: number | null; // ms
    stressLevel: StressLevel;
  };

  /** Heart rate */
  heartRate: {
    resting: number | null; // bpm
  };

  /** Body temperature */
  temperatureDelta: number | null; // deviation from baseline

  /** How recent the data is */
  dataFreshnessHours: number;

  /** Number of days of historical data available */
  historicalDays: number;
}
