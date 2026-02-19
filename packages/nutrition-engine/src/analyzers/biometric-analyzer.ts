// ============================================================
// Biometric Analyzer - Pure deterministic classification
// No LLM calls. Converts raw wearable data into actionable states.
// ============================================================

import type {
  BiometricContext,
  SleepQuality,
  StressLevel,
  RecoveryState,
} from '../types/biometric-context';

/** Minimum days of data before biometric adjustments activate */
const MIN_DATA_DAYS = 7;

interface RawBiometricInput {
  readinessScore: number | null;
  sleepScore: number | null;
  sleepTotalMinutes: number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes: number | null;
  sleepEfficiency: number | null;
  bedtimeStart: string | null;
  bedtimeEnd: string | null;
  hrvCurrent: number | null;
  hrvSevenDayAvg: number | null;
  restingHeartRate: number | null;
  temperatureDelta: number | null;
  lastSyncAt: Date | null;
  historicalDays: number;
}

/**
 * Build a BiometricContext from raw wearable data
 */
export function analyzeBiometrics(input: RawBiometricInput): BiometricContext {
  const dataAvailable = input.historicalDays >= MIN_DATA_DAYS;
  const dataFreshnessHours = input.lastSyncAt
    ? (Date.now() - input.lastSyncAt.getTime()) / (1000 * 60 * 60)
    : Infinity;

  const sleepQuality = classifySleepQuality(
    input.sleepScore,
    input.sleepDeepMinutes,
    input.sleepTotalMinutes
  );

  const stressLevel = classifyStressLevel(input.hrvCurrent, input.hrvSevenDayAvg);

  const recoveryState = classifyRecoveryState(input.readinessScore, sleepQuality, stressLevel);

  return {
    dataAvailable,
    readinessScore: input.readinessScore,
    recoveryState,
    sleep: {
      quality: sleepQuality,
      score: input.sleepScore,
      totalMinutes: input.sleepTotalMinutes,
      deepMinutes: input.sleepDeepMinutes,
      remMinutes: input.sleepRemMinutes,
      efficiency: input.sleepEfficiency,
      bedtimeStart: input.bedtimeStart,
      bedtimeEnd: input.bedtimeEnd,
    },
    hrv: {
      current: input.hrvCurrent,
      sevenDayAvg: input.hrvSevenDayAvg,
      stressLevel,
    },
    heartRate: {
      resting: input.restingHeartRate,
    },
    temperatureDelta: input.temperatureDelta,
    dataFreshnessHours: Math.round(dataFreshnessHours * 10) / 10,
    historicalDays: input.historicalDays,
  };
}

/**
 * Classify sleep quality based on score, deep sleep percentage, and duration
 */
export function classifySleepQuality(
  sleepScore: number | null,
  deepMinutes: number | null,
  totalMinutes: number | null
): SleepQuality {
  if (sleepScore === null) return 'fair'; // default when no data

  // Deep sleep percentage (target: 15-25% of total)
  const deepPct =
    deepMinutes !== null && totalMinutes !== null && totalMinutes > 0
      ? (deepMinutes / totalMinutes) * 100
      : null;

  // Duration check (target: 7-9 hours = 420-540 min)
  const durationOk = totalMinutes !== null && totalMinutes >= 390; // 6.5h minimum

  if (sleepScore >= 85 && (deepPct === null || deepPct >= 15) && durationOk) return 'excellent';
  if (sleepScore >= 70 && durationOk) return 'good';
  if (sleepScore >= 55) return 'fair';
  return 'poor';
}

/**
 * Classify stress level based on HRV relative to personal 7-day baseline.
 * Uses personal baselines (not absolute thresholds).
 */
export function classifyStressLevel(
  currentHrv: number | null,
  sevenDayAvg: number | null
): StressLevel {
  if (currentHrv === null || sevenDayAvg === null || sevenDayAvg <= 0) return 'moderate'; // default

  const ratio = currentHrv / sevenDayAvg;

  if (ratio >= 1.05) return 'low'; // HRV above baseline = low stress
  if (ratio >= 0.9) return 'moderate';
  if (ratio >= 0.75) return 'high';
  return 'very_high'; // HRV 25%+ below baseline
}

/**
 * Classify recovery state by combining readiness, sleep quality, and stress.
 */
export function classifyRecoveryState(
  readinessScore: number | null,
  sleepQuality: SleepQuality,
  stressLevel: StressLevel
): RecoveryState {
  // If we have a readiness score, weight it heavily
  if (readinessScore !== null) {
    if (readinessScore >= 80 && sleepQuality !== 'poor' && stressLevel !== 'very_high') {
      return 'recovered';
    }
    if (readinessScore >= 65 && sleepQuality !== 'poor') {
      return 'adequate';
    }
    if (readinessScore >= 50) {
      return 'compromised';
    }
    return 'depleted';
  }

  // Fallback: use sleep + stress only
  if (sleepQuality === 'excellent' && (stressLevel === 'low' || stressLevel === 'moderate')) {
    return 'recovered';
  }
  if (sleepQuality === 'good' && stressLevel !== 'very_high') {
    return 'adequate';
  }
  if (sleepQuality === 'poor' || stressLevel === 'very_high') {
    return 'depleted';
  }
  return 'compromised';
}
