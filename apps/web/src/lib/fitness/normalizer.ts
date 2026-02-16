// ============================================================
// Activity Data Normalization
// ============================================================

import {
  NormalizedActivity,
  Workout,
  WorkoutType,
  SleepData,
  HealthKitDataPoint,
  GoogleFitDataBucket,
  FitbitActivityResponse,
  FitbitSleepResponse,
  OuraActivityResponse,
  OuraSleepResponse,
  OuraWorkoutResponse,
} from './types';

/**
 * Normalize Apple HealthKit data to standard format
 */
export function normalizeAppleHealthData(
  data: HealthKitDataPoint[],
  syncDate: Date
): NormalizedActivity {
  const workouts: Workout[] = [];
  let steps = 0;
  let activeCalories = 0;
  let totalCalories = 0;
  let distanceKm = 0;
  let heartRateAvg: number | undefined;
  let heartRateMax: number | undefined;

  for (const point of data) {
    switch (point.type) {
      case 'HKQuantityTypeIdentifierStepCount':
        steps += Math.round(point.value);
        break;

      case 'HKQuantityTypeIdentifierActiveEnergyBurned':
        activeCalories += point.value;
        break;

      case 'HKQuantityTypeIdentifierBasalEnergyBurned':
        totalCalories += point.value;
        break;

      case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
        if (point.unit === 'km') {
          distanceKm += point.value;
        } else if (point.unit === 'mi') {
          distanceKm += point.value * 1.60934;
        }
        break;

      case 'HKQuantityTypeIdentifierHeartRate':
        // Heart rate is stored as individual samples
        if (!heartRateAvg) {
          heartRateAvg = point.value;
        }
        if (!heartRateMax || point.value > heartRateMax) {
          heartRateMax = Math.round(point.value);
        }
        break;

      case 'HKWorkoutType':
        // Parse workout metadata
        if (point.startDate && point.endDate) {
          const workoutType = mapAppleWorkoutType(point.unit);
          const startTime = new Date(point.startDate);
          const endTime = new Date(point.endDate);
          const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

          workouts.push({
            type: workoutType,
            startTime,
            endTime,
            durationMinutes,
            caloriesBurned: Math.round(point.value),
            rawType: point.unit,
          });
        }
        break;
    }
  }

  // Add active calories to basal for total
  totalCalories += activeCalories;

  return {
    platform: 'apple_health',
    syncDate,
    steps: steps || undefined,
    activeCalories: activeCalories || undefined,
    totalCalories: totalCalories || undefined,
    distanceKm: distanceKm || undefined,
    distanceMiles: distanceKm ? distanceKm * 0.621371 : undefined,
    activeMinutes: workouts.reduce((sum, w) => sum + w.durationMinutes, 0) || undefined,
    workouts: workouts.length > 0 ? workouts : undefined,
    heartRateAvg,
    heartRateMax,
  };
}

/**
 * Normalize Google Fit data to standard format
 */
export function normalizeGoogleFitData(
  buckets: GoogleFitDataBucket[],
  syncDate: Date
): NormalizedActivity {
  const workouts: Workout[] = [];
  let steps = 0;
  let activeCalories = 0;
  let distanceKm = 0;

  for (const bucket of buckets) {
    for (const dataset of bucket.dataset) {
      for (const point of dataset.point) {
        const dataType = point.dataTypeName;

        for (const value of point.value) {
          switch (dataType) {
            case 'com.google.step_count.delta':
              if (value.intVal) steps += value.intVal;
              break;

            case 'com.google.calories.expended':
              if (value.fpVal) activeCalories += value.fpVal;
              break;

            case 'com.google.distance.delta':
              if (value.fpVal) {
                // Google Fit reports in meters
                distanceKm += value.fpVal / 1000;
              }
              break;
          }
        }

        // Check for workout session
        if (dataType === 'com.google.activity.segment') {
          const startTime = new Date(Number(point.startTimeNanos) / 1000000);
          const endTime = new Date(Number(point.endTimeNanos) / 1000000);
          const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

          // Try to determine workout type from data source
          const firstValue = point.value[0];
          const activityType = firstValue?.fpVal
            ? mapGoogleFitActivityType(Math.round(firstValue.fpVal))
            : 'other';

          workouts.push({
            type: activityType,
            startTime,
            endTime,
            durationMinutes,
            caloriesBurned: Math.round(activeCalories / (workouts.length + 1)), // Approximate
            rawType: dataType,
          });
        }
      }
    }
  }

  return {
    platform: 'google_fit',
    syncDate,
    steps: steps || undefined,
    activeCalories: activeCalories || undefined,
    distanceKm: distanceKm || undefined,
    distanceMiles: distanceKm ? distanceKm * 0.621371 : undefined,
    activeMinutes: workouts.reduce((sum, w) => sum + w.durationMinutes, 0) || undefined,
    workouts: workouts.length > 0 ? workouts : undefined,
  };
}

/**
 * Normalize Fitbit data to standard format
 */
export function normalizeFitbitData(
  activityData: FitbitActivityResponse,
  sleepData?: FitbitSleepResponse,
  syncDate?: Date
): NormalizedActivity {
  const summary = activityData.summary;
  const workouts: Workout[] = [];

  // Convert Fitbit activities to workouts
  for (const activity of activityData.activities) {
    const startTime = new Date(activity.startTime);
    const endTime = new Date(startTime.getTime() + activity.duration * 1000);

    workouts.push({
      type: mapFitbitActivityType(activity.activityName),
      startTime,
      endTime,
      durationMinutes: Math.round(activity.duration / 60000),
      caloriesBurned: activity.calories,
      distanceKm:
        activity.distanceUnit === 'Kilometers' ? activity.distance : activity.distance * 1.60934,
      heartRateAvg: activity.averageHeartRate,
      rawType: activity.activityName,
    });
  }

  // Normalize sleep data
  let sleepDataNormalized: SleepData | undefined;
  if (sleepData && sleepData.sleep.length > 0) {
    const mainSleep = sleepData.sleep.find((s) => s.isMainSleep) || sleepData.sleep[0];
    sleepDataNormalized = {
      totalMinutes: mainSleep.minutesAsleep,
      deepMinutes: mainSleep.levels.deep.minutes,
      lightMinutes: mainSleep.levels.light.minutes,
      remMinutes: mainSleep.levels.rem.minutes,
      awakeMinutes: mainSleep.levels.wake.minutes,
      efficiency: mainSleep.efficiency,
      bedtime: new Date(mainSleep.startTime),
      wakeTime: new Date(new Date(mainSleep.startTime).getTime() + mainSleep.duration * 1000),
    };
  }

  return {
    platform: 'fitbit',
    syncDate: syncDate || new Date(),
    steps: summary.steps,
    activeCalories: summary.activityCalories,
    totalCalories: summary.caloriesOut,
    distanceKm: summary.distance,
    distanceMiles: summary.distances.find((d) => d.activity === 'total')?.distance,
    activeMinutes: summary.veryActiveMinutes + summary.fairlyActiveMinutes,
    workouts: workouts.length > 0 ? workouts : undefined,
    sleepData: sleepDataNormalized,
  };
}

/**
 * Normalize Oura data to standard format
 */
export function normalizeOuraData(
  activityData: OuraActivityResponse,
  sleepData?: OuraSleepResponse,
  workoutData?: OuraWorkoutResponse
): NormalizedActivity {
  // Get the first (most recent) activity data point
  const activity = activityData.data[0];

  const workouts: Workout[] = [];
  if (workoutData && workoutData.data.length > 0) {
    for (const workout of workoutData.data) {
      const startTime = new Date(workout.timestamp);
      const durationMinutes = Math.round((workout.duration_km || 30) * 60); // Approximate

      workouts.push({
        type: mapOuraActivityType(workout.activity),
        startTime,
        durationMinutes,
        caloriesBurned: workout.calories,
        distanceKm: workout.distance,
        heartRateAvg: workout.heart_rate?.avg,
        heartRateMax: workout.heart_rate?.max,
        rawType: workout.activity,
      });
    }
  }

  // Normalize sleep data
  let sleepDataNormalized: SleepData | undefined;
  if (sleepData && sleepData.data.length > 0) {
    const sleep = sleepData.data[0];
    sleepDataNormalized = {
      totalMinutes: sleep.duration,
      remMinutes: sleep.rem,
      deepMinutes: sleep.deep,
      lightMinutes: sleep.light,
      awakeMinutes: sleep.awake,
      sleepScore: sleep.score,
      efficiency: sleep.efficiency,
      bedtime: new Date(sleep.bedtime_start),
      wakeTime: new Date(sleep.bedtime_end),
    };
  }

  return {
    platform: 'oura',
    syncDate: new Date(activity.timestamp),
    steps: activity.steps,
    activeCalories: activity.active_calories,
    totalCalories: activity.total_calories,
    distanceKm: activity.distance_km,
    distanceMiles: activity.distance_km * 0.621371,
    activeMinutes: activity.medium_activity_met_minutes
      ? Math.round(activity.medium_activity_met_minutes + (activity.high_activity_met_minutes ?? 0))
      : undefined,
    workouts: workouts.length > 0 ? workouts : undefined,
    sleepData: sleepDataNormalized,
  };
}

/**
 * Map Apple HealthKit workout type to standard type
 */
function mapAppleWorkoutType(appleType: string): WorkoutType {
  const typeMap: Record<string, WorkoutType> = {
    HKWorkoutActivityTypeWalking: 'walking',
    HKWorkoutActivityTypeRunning: 'running',
    HKWorkoutActivityTypeCycling: 'cycling',
    HKWorkoutActivityTypeSwimming: 'swimming',
    HKWorkoutActivityTypeTraditionalStrengthTraining: 'strength_training',
    HKWorkoutActivityTypeHighIntensityIntervalTraining: 'hiit',
    HKWorkoutActivityTypeYoga: 'yoga',
    HKWorkoutActivityTypeFunctionalStrengthTraining: 'strength_training',
    HKWorkoutActivityTypeCrossTraining: 'crossfit',
  };

  return typeMap[appleType] || 'other';
}

/**
 * Map Google Fit activity type to standard type
 */
function mapGoogleFitActivityType(googleType: number): WorkoutType {
  // Google Fit activity type codes
  // https://developers.google.com/fit/rest/v1/reference/rest/v1/users.dataSources.datasets
  if (googleType >= 7 && googleType <= 8) return 'walking';
  if (googleType === 9) return 'running';
  if (googleType === 10) return 'cycling';
  if (googleType >= 11 && googleType <= 13) return 'swimming';
  if (googleType === 25) return 'strength_training';
  if (googleType === 29) return 'hiit';
  if (googleType === 34) return 'yoga';

  return 'other';
}

/**
 * Map Fitbit activity type to standard type
 */
function mapFitbitActivityType(fitbitType: string): WorkoutType {
  const typeMap: Record<string, WorkoutType> = {
    Walk: 'walking',
    Run: 'running',
    'Morning Walk': 'walking',
    'Afternoon Walk': 'walking',
    'Evening Walk': 'walking',
    Cycling: 'cycling',
    'Outdoor Bike': 'cycling',
    Swim: 'swimming',
    LapSwimming: 'swimming',
    Weights: 'strength_training',
    'Strength Training': 'strength_training',
    HIIT: 'hiit',
    'Interval Training': 'hiit',
    Yoga: 'yoga',
    Workout: 'other',
    Sport: 'other',
  };

  // Try exact match first
  if (typeMap[fitbitType]) {
    return typeMap[fitbitType];
  }

  // Try partial match
  const lowerType = fitbitType.toLowerCase();
  if (lowerType.includes('walk')) return 'walking';
  if (lowerType.includes('run')) return 'running';
  if (lowerType.includes('cycl')) return 'cycling';
  if (lowerType.includes('swim')) return 'swimming';
  if (lowerType.includes('weight') || lowerType.includes('strength')) return 'strength_training';
  if (lowerType.includes('hiit') || lowerType.includes('interval')) return 'hiit';
  if (lowerType.includes('yoga')) return 'yoga';

  return 'other';
}

/**
 * Map Oura activity type to standard type
 */
function mapOuraActivityType(ouraType: string): WorkoutType {
  const typeMap: Record<string, WorkoutType> = {
    walking: 'walking',
    running: 'running',
    cycling: 'cycling',
    swimming: 'swimming',
    strength_training: 'strength_training',
    hiit: 'hiit',
    yoga: 'yoga',
    crossfit: 'crossfit',
  };

  return typeMap[ouraType.toLowerCase()] || 'other';
}

/**
 * Validate normalized activity data
 */
export function validateActivityData(activity: NormalizedActivity): boolean {
  // Must have at least some data
  const hasData =
    !!activity.steps ||
    !!activity.activeCalories ||
    !!activity.totalCalories ||
    (activity.workouts && activity.workouts.length > 0) ||
    !!activity.sleepData;

  if (!hasData) {
    return false;
  }

  // Validate numeric ranges
  if (activity.steps !== undefined && (activity.steps < 0 || activity.steps > 1000000)) {
    return false;
  }

  if (
    activity.activeCalories !== undefined &&
    (activity.activeCalories < 0 || activity.activeCalories > 50000)
  ) {
    return false;
  }

  if (
    activity.totalCalories !== undefined &&
    (activity.totalCalories < 0 || activity.totalCalories > 50000)
  ) {
    return false;
  }

  // Validate workouts
  if (activity.workouts) {
    for (const workout of activity.workouts) {
      if (workout.durationMinutes < 0 || workout.durationMinutes > 1440) {
        return false; // More than 24 hours
      }
      if (workout.caloriesBurned < 0 || workout.caloriesBurned > 10000) {
        return false;
      }
    }
  }

  // Validate sleep data
  if (activity.sleepData) {
    if (activity.sleepData.totalMinutes < 0 || activity.sleepData.totalMinutes > 1440) {
      return false;
    }
    if (
      activity.sleepData.sleepScore !== undefined &&
      (activity.sleepData.sleepScore < 0 || activity.sleepData.sleepScore > 100)
    ) {
      return false;
    }
  }

  return true;
}
