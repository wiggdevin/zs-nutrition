// ============================================================
// Fitness Tracker Integration Types
// ============================================================

/**
 * Supported fitness platforms
 */
export type FitnessPlatform = 'apple_health' | 'google_fit' | 'fitbit' | 'oura' | 'aggregated';

/**
 * Sync frequency preferences
 */
export type SyncFrequency = 'hourly' | 'daily' | 'weekly';

/**
 * Workout types across platforms
 */
export type WorkoutType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'strength_training'
  | 'hiit'
  | 'yoga'
  | 'crossfit'
  | 'other';

/**
 * Normalized activity data from any fitness platform
 */
export interface NormalizedActivity {
  platform: FitnessPlatform;
  syncDate: Date;
  steps?: number;
  activeCalories?: number;
  totalCalories?: number;
  distanceKm?: number;
  distanceMiles?: number;
  activeMinutes?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  workouts?: Workout[];
  sleepData?: SleepData;
}

/**
 * Individual workout data
 */
export interface Workout {
  type: WorkoutType;
  startTime: Date;
  endTime?: Date;
  durationMinutes: number;
  caloriesBurned: number;
  distanceKm?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  rawType?: string; // Original platform-specific type
}

/**
 * Sleep data (primarily from Oura)
 */
export interface SleepData {
  totalMinutes: number;
  remMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  awakeMinutes?: number;
  sleepScore?: number; // 0-100 quality score
  efficiency?: number; // percentage
  bedtime?: Date;
  wakeTime?: Date;
}

/**
 * Platform-specific connection data
 */
export interface PlatformConnectionData {
  platform: FitnessPlatform;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  platformUserId?: string;
  scope?: string;
}

// ============================================================
// Apple HealthKit Types
// ============================================================

/**
 * Apple HealthKit OAuth configuration
 */
export interface AppleHealthConfig {
  clientId: string;
  redirectUri: string;
  scopes: HealthKitScope[];
}

export type HealthKitScope =
  | 'step_count'
  | 'active_energy'
  | 'basal_energy'
  | 'distance'
  | 'heart_rate'
  | 'workouts'
  | 'sleep_analysis';

/**
 * Apple HealthKit API response
 */
export interface HealthKitResponse {
  data: HealthKitDataPoint[];
  nextToken?: string;
}

export interface HealthKitDataPoint {
  date: string; // ISO date
  startDate?: string;
  endDate?: string;
  type: string;
  unit: string;
  value: number;
}

// ============================================================
// Google Fit Types
// ============================================================

/**
 * Google Fit OAuth configuration
 */
export interface GoogleFitConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Google Fit API response
 */
export interface GoogleFitResponse {
  bucket: GoogleFitDataBucket[];
}

export interface GoogleFitDataBucket {
  startTimeMillis: number;
  endTimeMillis: number;
  dataset: GoogleFitDataset[];
}

export interface GoogleFitDataset {
  dataSourceId: string;
  point: GoogleFitDataPoint[];
}

export interface GoogleFitDataPoint {
  startTimeNanos: number;
  endTimeNanos: number;
  dataTypeName: string;
  value: GoogleFitValue[];
}

export interface GoogleFitValue {
  intVal?: number;
  fpVal?: number;
  mapVal?: any;
}

// ============================================================
// Fitbit Types
// ============================================================

/**
 * Fitbit OAuth configuration
 */
export interface FitbitConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Fitbit API response - Activity Summary
 */
export interface FitbitActivityResponse {
  summary: FitbitActivitySummary;
  activities: FitbitActivity[];
}

export interface FitbitActivitySummary {
  steps: number;
  floors: number;
  veryActiveMinutes: number;
  fairlyActiveMinutes: number;
  lightlyActiveMinutes: number;
  sedentaryMinutes: number;
  activityCalories: number;
  caloriesOut: number;
  distance: number; // in km or miles based on locale
  distances: FitbitDistance[];
}

export interface FitbitDistance {
  activity: string;
  distance: number;
}

export interface FitbitActivity {
  activityId: number;
  activityName: string;
  activityTypeId: number;
  averageHeartRate?: number;
  calories: number;
  description: string;
  distance: number;
  distanceUnit: string;
  duration: number;
  hasActiveZoneMinutes?: boolean;
  heartRateZones?: FitbitHeartRateZone[];
  lastModified: string;
  logId: number;
  logType: string;
  manualValuesSpecified?: {
    calories?: boolean;
    distance?: boolean;
    steps?: boolean;
  };
  name: string;
  startTime: string;
  steps: number;
}

export interface FitbitHeartRateZone {
  name: string;
  min: number;
  max: number;
  minutes: number;
}

/**
 * Fitbit sleep data
 */
export interface FitbitSleepResponse {
  summary: FitbitSleepSummary;
  sleep: FitbitSleepLog[];
}

export interface FitbitSleepSummary {
  totalSleepRecords: number;
  totalSleepTime: number;
  totalTimeInBed: number;
}

export interface FitbitSleepLog {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  isMainSleep: boolean;
  levels: FitbitSleepLevels;
  logId: number;
  minutesAfterWakeup: number;
  minutesAsleep: number;
  minutesAwake: number;
  minutesToFallAsleep: number;
  startTime: string;
  timeInBed: number;
  type: string;
}

export interface FitbitSleepLevels {
  deep: FitbitSleepLevelData;
  light: FitbitSleepLevelData;
  rem: FitbitSleepLevelData;
  wake: FitbitSleepLevelData;
}

export interface FitbitSleepLevelData {
  count: number;
  minutes: number;
  thirtyDayAvgMinutes: number;
}

// ============================================================
// Oura API Types
// ============================================================

/**
 * Oura API OAuth configuration
 */
export interface OuraConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Oura API v2 response - Daily Activity
 */
export interface OuraActivityResponse {
  data: OuraActivityData[];
  next_token?: string;
}

export interface OuraActivityData {
  timestamp: string; // ISO date
  score?: number; // 0-100 activity score
  active_calories: number;
  steps: number;
  distance_km: number;
  equivalent_walking_distance_km: number;
  high_activity_met_minutes?: number;
  medium_activity_met_minutes?: number;
  low_activity_met_minutes?: number;
  resting_met_minutes?: number;
  total_calories: number;
  average_met_minutes?: number;
  target_calories: number;
}

/**
 * Oura sleep data
 */
export interface OuraSleepResponse {
  data: OuraSleepData[];
  next_token?: string;
}

export interface OuraSleepData {
  timestamp: string;
  score: number; // 0-100 sleep score
  total: number;
  duration: number;
  efficiency: number;
  deep: number;
  light: number;
  rem: number;
  awake: number;
  bedtime_start: string;
  bedtime_end: string;
  restful_periods?: number;
  sleep_algorithm_version?: number;
}

/**
 * Oura workout data
 */
export interface OuraWorkoutResponse {
  data: OuraWorkoutData[];
  next_token?: string;
}

export interface OuraWorkoutData {
  timestamp: string;
  activity: string;
  duration_km?: number;
  distance?: number;
  calories: number;
  heart_rate?: {
    avg: number;
    max: number;
    zones: {
      zone_1: number; // minutes
      zone_2: number;
      zone_3: number;
    };
  };
  intensity?: string;
}

// ============================================================
// Calorie Adjustment Types
// ============================================================

/**
 * Calorie adjustment configuration
 */
export interface CalorieAdjustmentConfig {
  enabled: boolean;
  safetyFactor: number; // Multiplier for active calories (0.5 - 1.0)
  maxDailyIncrease: number; // Maximum calories to add per day
  minWorkoutMinutes: number; // Minimum workout duration to trigger adjustment
  adjustmentWindow: number; // Hours after workout to apply adjustment
  requireManualApproval: boolean;
}

/**
 * Calorie adjustment result
 */
export interface CalorieAdjustment {
  originalTarget: number;
  newTarget: number;
  adjustment: number;
  reason: string;
  activityData: {
    platform: FitnessPlatform;
    activeCalories: number;
    workoutCount: number;
    totalActiveMinutes: number;
  };
  appliedAt: Date;
}

/**
 * Meal plan adjustment recommendation
 */
export interface MealPlanAdjustment {
  dayNumber: number;
  originalCalories: number;
  adjustedCalories: number;
  adjustmentPercentage: number;
  meals: {
    slot: string;
    originalCalories: number;
    adjustedCalories: number;
  }[];
}
