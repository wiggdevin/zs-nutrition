// ============================================================
// Oura Ring API v2 Types (Corrected)
// ============================================================

/** Oura v2 daily activity response */
export interface OuraDailyActivity {
  id: string;
  day: string; // YYYY-MM-DD (NOT timestamp)
  score: number | null;
  active_calories: number;
  steps: number;
  equivalent_walking_distance: number;
  high_activity_met_minutes: number;
  medium_activity_met_minutes: number;
  low_activity_met_minutes: number;
  sedentary_met_minutes: number;
  resting_time: number; // seconds
  total_calories: number;
  target_calories: number;
  met: { interval: number; items: number[]; timestamp: string };
  class_5_min: string | null;
  timestamp: string;
}

/** Oura v2 daily sleep response */
export interface OuraDailySleep {
  id: string;
  day: string; // YYYY-MM-DD
  score: number | null;
  contributors: {
    deep_sleep: number | null;
    efficiency: number | null;
    latency: number | null;
    rem_sleep: number | null;
    restfulness: number | null;
    timing: number | null;
    total_sleep: number | null;
  };
  timestamp: string;
}

/** Oura v2 sleep period (detailed) */
export interface OuraSleepPeriod {
  id: string;
  day: string;
  bedtime_start: string; // ISO datetime
  bedtime_end: string;
  type: 'long_sleep' | 'short_sleep' | 'rest';
  duration: number; // seconds
  total_sleep_duration: number; // seconds
  awake_time: number; // seconds
  light_sleep_duration: number; // seconds
  deep_sleep_duration: number; // seconds
  rem_sleep_duration: number; // seconds
  restless_periods: number;
  efficiency: number; // 0-100
  latency: number; // seconds
  average_heart_rate: number | null;
  lowest_heart_rate: number | null;
  average_hrv: number | null;
  time_in_bed: number; // seconds
  timestamp: string;
}

/** Oura v2 daily readiness */
export interface OuraDailyReadiness {
  id: string;
  day: string; // YYYY-MM-DD
  score: number | null; // 0-100
  temperature_deviation: number | null;
  temperature_trend_deviation: number | null;
  contributors: {
    activity_balance: number | null;
    body_temperature: number | null;
    hrv_balance: number | null;
    previous_day_activity: number | null;
    previous_night: number | null;
    recovery_index: number | null;
    resting_heart_rate: number | null;
    sleep_balance: number | null;
  };
  timestamp: string;
}

/** Oura v2 heart rate sample */
export interface OuraHeartRateSample {
  bpm: number;
  source: 'awake' | 'rest' | 'sleep' | 'session' | 'live';
  timestamp: string;
}

/** Oura v2 workout */
export interface OuraWorkout {
  id: string;
  day: string;
  activity: string;
  calories: number | null;
  distance: number | null; // meters
  end_datetime: string;
  intensity: 'easy' | 'moderate' | 'hard';
  label: string | null;
  source: string;
  start_datetime: string;
}

/** Oura v2 paginated response wrapper */
export interface OuraListResponse<T> {
  data: T[];
  next_token: string | null;
}

/** All data fetched for a single day sync */
export interface OuraDaySyncData {
  activity: OuraDailyActivity | null;
  sleep: OuraDailySleep | null;
  sleepPeriods: OuraSleepPeriod[];
  readiness: OuraDailyReadiness | null;
  heartRate: OuraHeartRateSample[];
  workouts: OuraWorkout[];
}
