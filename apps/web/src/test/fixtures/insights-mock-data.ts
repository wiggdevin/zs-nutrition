/**
 * Mock data factories for AI Insights testing.
 *
 * Every factory returns plain objects that match the shape of the
 * corresponding Prisma model (id, userId, date fields as Date objects, etc.)
 * so they can be returned directly from mocked Prisma methods.
 */

import { randomUUID } from 'crypto';

// ============================================================
// Types mirroring Prisma model shapes
// ============================================================

export interface MockDailyLog {
  id: string;
  userId: string;
  date: Date;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  actualKcal: number;
  actualProteinG: number;
  actualCarbsG: number;
  actualFatG: number;
  adherenceScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockTrackedMeal {
  id: string;
  userId: string;
  mealPlanId: string | null;
  loggedDate: Date;
  mealSlot: string | null;
  mealName: string;
  portion: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  source: string;
  confidenceScore: number | null;
  foodId: string | null;
  photoUrl: string | null;
  scanId: string | null;
  createdAt: Date;
}

export interface MockWeightEntry {
  id: string;
  userId: string;
  weightKg: number;
  weightLbs: number;
  logDate: Date;
  notes: string | null;
  createdAt: Date;
}

export interface MockMealSwap {
  id: string;
  mealPlanId: string;
  dayNumber: number;
  slot: string;
  originalMeal: Record<string, unknown>;
  newMeal: Record<string, unknown>;
  createdAt: Date;
}

export interface MockActivitySync {
  id: string;
  userId: string;
  connectionId: string;
  platform: string;
  syncDate: Date;
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  distanceKm: number | null;
  distanceMiles: number | null;
  activeMinutes: number | null;
  workoutCount: number | null;
  workouts: unknown | null;
  sleepMinutes: number | null;
  sleepScore: number | null;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  heartRateResting: number | null;
  readinessScore: number | null;
  readinessTemperature: number | null;
  readinessHrvBalance: number | null;
  hrvAvg: number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes: number | null;
  sleepLightMinutes: number | null;
  sleepAwakeMinutes: number | null;
  sleepEfficiency: number | null;
  sleepLatency: number | null;
  bedtimeStart: Date | null;
  bedtimeEnd: Date | null;
  bodyTemperatureDelta: number | null;
  rawSyncData: unknown | null;
  syncedAt: Date;
  processed: boolean;
}

export interface MockUserProfile {
  id: string;
  userId: string;
  name: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent: number | null;
  goalType: string;
  goalRate: number;
  activityLevel: string;
  dietaryStyle: string;
  allergies: string[] | null;
  exclusions: string[] | null;
  cuisinePrefs: string[] | null;
  trainingDays: string[] | null;
  trainingTime: string | null;
  mealsPerDay: number;
  snacksPerDay: number;
  cookingSkill: number;
  prepTimeMax: number;
  macroStyle: string;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  goalKcal: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockUserScenario {
  dailyLogs: MockDailyLog[];
  trackedMeals: MockTrackedMeal[];
  weightEntries: MockWeightEntry[];
  mealSwaps: MockMealSwap[];
  activitySyncs: MockActivitySync[];
  userProfile: MockUserProfile;
}

// ============================================================
// Shared constants
// ============================================================

const DEFAULT_USER_ID = 'test-user-id';
const DEFAULT_MEAL_PLAN_ID = 'test-meal-plan-id';
const DEFAULT_CONNECTION_ID = 'test-connection-id';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const MEAL_NAMES: Record<string, string[]> = {
  breakfast: [
    'Oatmeal with Berries',
    'Greek Yogurt Parfait',
    'Egg White Omelette',
    'Protein Pancakes',
  ],
  lunch: ['Grilled Chicken Salad', 'Turkey Wrap', 'Quinoa Bowl', 'Tuna Sandwich'],
  dinner: ['Salmon with Rice', 'Chicken Stir Fry', 'Lean Beef Tacos', 'Shrimp Pasta'],
  snack: ['Protein Bar', 'Apple with Almond Butter', 'Trail Mix', 'Cottage Cheese'],
};

// ============================================================
// Utility helpers
// ============================================================

/** Returns a random integer in [min, max] (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random float in [min, max]. */
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Picks a random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Creates a Date set to midnight UTC `daysAgo` days before today. */
function daysAgoDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

/** Returns true if the given date falls on a Saturday or Sunday. */
function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// ============================================================
// createMockDailyLogs
// ============================================================

export function createMockDailyLogs(
  days: number,
  adherenceRange: [number, number],
  overrides?: Partial<{
    userId: string;
    targetKcal: number;
    targetProteinG: number;
    targetCarbsG: number;
    targetFatG: number;
  }>
): MockDailyLog[] {
  const userId = overrides?.userId ?? DEFAULT_USER_ID;
  const targetKcal = overrides?.targetKcal ?? 2000;
  const targetProteinG = overrides?.targetProteinG ?? 150;
  const targetCarbsG = overrides?.targetCarbsG ?? 200;
  const targetFatG = overrides?.targetFatG ?? 65;

  return Array.from({ length: days }, (_, i) => {
    const adherence = randInt(adherenceRange[0], adherenceRange[1]);
    // Scale actuals relative to adherence so a high-adherence day stays close to targets
    const factor = adherence / 100;
    const jitter = () => randFloat(0.85, 1.15);

    const now = new Date();
    return {
      id: randomUUID(),
      userId,
      date: daysAgoDate(days - 1 - i),
      targetKcal,
      targetProteinG,
      targetCarbsG,
      targetFatG,
      actualKcal: Math.round(targetKcal * factor * jitter()),
      actualProteinG: Math.round(targetProteinG * factor * jitter()),
      actualCarbsG: Math.round(targetCarbsG * factor * jitter()),
      actualFatG: Math.round(targetFatG * factor * jitter()),
      adherenceScore: adherence,
      createdAt: now,
      updatedAt: now,
    };
  });
}

// ============================================================
// createMockTrackedMeals
// ============================================================

export function createMockTrackedMeals(
  days: number,
  sources: Record<string, number>,
  overrides?: Partial<{ userId: string; mealPlanId: string }>
): MockTrackedMeal[] {
  const userId = overrides?.userId ?? DEFAULT_USER_ID;
  const mealPlanId = overrides?.mealPlanId ?? DEFAULT_MEAL_PLAN_ID;

  // Build a cumulative distribution for source selection
  const sourceEntries = Object.entries(sources);
  const cumulative: { source: string; threshold: number }[] = [];
  let acc = 0;
  for (const [source, pct] of sourceEntries) {
    acc += pct;
    cumulative.push({ source, threshold: acc });
  }

  function pickSource(): string {
    const r = Math.random();
    for (const entry of cumulative) {
      if (r <= entry.threshold) return entry.source;
    }
    return cumulative[cumulative.length - 1].source;
  }

  const meals: MockTrackedMeal[] = [];

  for (let d = 0; d < days; d++) {
    const logDate = daysAgoDate(days - 1 - d);
    // 3-4 meals per day
    const mealsToday = randInt(3, 4);
    const slotsForDay = mealsToday === 4 ? [...SLOTS] : SLOTS.slice(0, 3);

    for (const slot of slotsForDay) {
      const source = pickSource();
      const mealName = pick(MEAL_NAMES[slot]);

      meals.push({
        id: randomUUID(),
        userId,
        mealPlanId: source === 'plan_meal' ? mealPlanId : null,
        loggedDate: logDate,
        mealSlot: slot,
        mealName,
        portion: 1.0,
        kcal: randInt(300, 700),
        proteinG: randFloat(15, 55),
        carbsG: randFloat(20, 80),
        fatG: randFloat(5, 30),
        fiberG: randFloat(2, 12),
        source,
        confidenceScore: source === 'food_scan' ? randFloat(0.7, 0.98) : null,
        foodId: source === 'fatsecret_search' ? `fs-${randomUUID().slice(0, 8)}` : null,
        photoUrl: null,
        scanId: null,
        createdAt: new Date(),
      });
    }
  }

  return meals;
}

// ============================================================
// createMockWeightEntries
// ============================================================

export function createMockWeightEntries(
  weeks: number,
  startLbs: number,
  rateLbs: number
): MockWeightEntry[] {
  return Array.from({ length: weeks }, (_, i) => {
    const lbs = startLbs + rateLbs * i + randFloat(-0.3, 0.3);
    const kg = lbs / 2.205;
    return {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
      weightKg: Math.round(kg * 100) / 100,
      weightLbs: Math.round(lbs * 100) / 100,
      logDate: daysAgoDate((weeks - 1 - i) * 7),
      notes: null,
      createdAt: new Date(),
    };
  });
}

// ============================================================
// createMockMealSwaps
// ============================================================

export function createMockMealSwaps(count: number, slotBias?: string): MockMealSwap[] {
  return Array.from({ length: count }, (_, i) => {
    const useBiasSlot = slotBias && Math.random() < 0.6;
    const slot = useBiasSlot ? slotBias : pick(SLOTS);

    return {
      id: randomUUID(),
      mealPlanId: DEFAULT_MEAL_PLAN_ID,
      dayNumber: (i % 7) + 1,
      slot,
      originalMeal: {
        name: pick(MEAL_NAMES[slot]),
        kcal: randInt(350, 600),
        proteinG: randInt(20, 45),
        carbsG: randInt(30, 70),
        fatG: randInt(8, 25),
      },
      newMeal: {
        name: pick(MEAL_NAMES[slot]),
        kcal: randInt(350, 600),
        proteinG: randInt(20, 45),
        carbsG: randInt(30, 70),
        fatG: randInt(8, 25),
      },
      createdAt: daysAgoDate(count - 1 - i),
    };
  });
}

// ============================================================
// createMockActivitySyncs
// ============================================================

export function createMockActivitySyncs(days: number, platform: string): MockActivitySync[] {
  return Array.from({ length: days }, (_, i) => {
    const syncDate = daysAgoDate(days - 1 - i);
    const sleepMinutes = randInt(300, 540); // 5-9 hours
    const deepPct = randFloat(0.12, 0.25);
    const remPct = randFloat(0.18, 0.28);
    const lightPct = randFloat(0.35, 0.55);

    return {
      id: randomUUID(),
      userId: DEFAULT_USER_ID,
      connectionId: DEFAULT_CONNECTION_ID,
      platform,
      syncDate,
      steps: randInt(3000, 12000),
      activeCalories: randFloat(200, 600),
      totalCalories: randFloat(1600, 2800),
      distanceKm: randFloat(2, 10),
      distanceMiles: randFloat(1.2, 6.2),
      activeMinutes: randInt(15, 90),
      workoutCount: randInt(0, 2),
      workouts: null,
      sleepMinutes,
      sleepScore: randInt(60, 95),
      heartRateAvg: randFloat(55, 80),
      heartRateMax: randInt(120, 185),
      heartRateResting: randFloat(48, 70),
      readinessScore: randInt(55, 90),
      readinessTemperature: randFloat(-0.5, 0.5),
      readinessHrvBalance: randInt(60, 95),
      hrvAvg: randFloat(25, 80),
      sleepDeepMinutes: Math.round(sleepMinutes * deepPct),
      sleepRemMinutes: Math.round(sleepMinutes * remPct),
      sleepLightMinutes: Math.round(sleepMinutes * lightPct),
      sleepAwakeMinutes: randInt(5, 40),
      sleepEfficiency: randFloat(75, 98),
      sleepLatency: randInt(120, 1800), // 2-30 minutes in seconds
      bedtimeStart: null,
      bedtimeEnd: null,
      bodyTemperatureDelta: randFloat(-0.3, 0.3),
      rawSyncData: null,
      syncedAt: new Date(),
      processed: true,
    };
  });
}

// ============================================================
// createMockUserProfile
// ============================================================

export function createMockUserProfile(overrides?: Partial<MockUserProfile>): MockUserProfile {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: DEFAULT_USER_ID,
    name: 'Test User',
    sex: 'male',
    age: 30,
    heightCm: 178,
    weightKg: 82,
    bodyFatPercent: 18,
    goalType: 'cut',
    goalRate: 1.0,
    activityLevel: 'moderately_active',
    dietaryStyle: 'omnivore',
    allergies: null,
    exclusions: null,
    cuisinePrefs: null,
    trainingDays: ['monday', 'wednesday', 'friday'],
    trainingTime: 'morning',
    mealsPerDay: 3,
    snacksPerDay: 1,
    cookingSkill: 5,
    prepTimeMax: 30,
    macroStyle: 'balanced',
    bmrKcal: 1850,
    tdeeKcal: 2500,
    goalKcal: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 65,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================
// createMockUserScenario
// ============================================================

export function createMockUserScenario(
  scenario:
    | 'healthy_active'
    | 'weekend_overeater'
    | 'protein_deficient'
    | 'weight_plateau'
    | 'new_user'
    | 'extreme_values'
): MockUserScenario {
  switch (scenario) {
    // ---- healthy_active ----
    case 'healthy_active': {
      const profile = createMockUserProfile();
      return {
        dailyLogs: createMockDailyLogs(14, [75, 95]),
        trackedMeals: createMockTrackedMeals(14, {
          plan_meal: 0.7,
          fatsecret_search: 0.2,
          manual: 0.1,
        }),
        weightEntries: createMockWeightEntries(3, 182, -0.8),
        mealSwaps: createMockMealSwaps(3),
        activitySyncs: createMockActivitySyncs(14, 'oura'),
        userProfile: profile,
      };
    }

    // ---- weekend_overeater ----
    case 'weekend_overeater': {
      const profile = createMockUserProfile({ goalType: 'cut', goalRate: 1.5 });

      // Build daily logs with split adherence: weekday 80-95, weekend 40-60
      const logs: MockDailyLog[] = [];
      for (let i = 0; i < 14; i++) {
        const date = daysAgoDate(13 - i);
        const weekend = isWeekend(date);
        const adherenceRange: [number, number] = weekend ? [40, 60] : [80, 95];
        const dayLogs = createMockDailyLogs(1, adherenceRange, {
          targetKcal: 2000,
          targetProteinG: 150,
          targetCarbsG: 200,
          targetFatG: 65,
        });
        // Override the date to our sequential date
        dayLogs[0].date = date;
        // Weekends: bump calories to 2500-3200
        if (weekend) {
          dayLogs[0].actualKcal = randInt(2500, 3200);
          dayLogs[0].actualFatG = randInt(80, 120);
        }
        logs.push(dayLogs[0]);
      }

      return {
        dailyLogs: logs,
        trackedMeals: createMockTrackedMeals(14, {
          plan_meal: 0.4,
          fatsecret_search: 0.3,
          manual: 0.3,
        }),
        weightEntries: createMockWeightEntries(3, 195, 0.2),
        mealSwaps: createMockMealSwaps(8, 'dinner'),
        activitySyncs: createMockActivitySyncs(14, 'oura'),
        userProfile: profile,
      };
    }

    // ---- protein_deficient ----
    case 'protein_deficient': {
      const profile = createMockUserProfile({
        proteinTargetG: 150,
        goalType: 'bulk',
        goalRate: 0.5,
      });

      const logs = createMockDailyLogs(14, [65, 85], {
        targetProteinG: 150,
      });
      // Force protein to be consistently ~30g below target
      for (const log of logs) {
        log.actualProteinG = randInt(100, 125);
      }

      return {
        dailyLogs: logs,
        trackedMeals: createMockTrackedMeals(14, {
          plan_meal: 0.5,
          fatsecret_search: 0.3,
          manual: 0.2,
        }),
        weightEntries: createMockWeightEntries(3, 165, 0.3),
        mealSwaps: createMockMealSwaps(4),
        activitySyncs: createMockActivitySyncs(14, 'oura'),
        userProfile: profile,
      };
    }

    // ---- weight_plateau ----
    case 'weight_plateau': {
      const profile = createMockUserProfile({
        goalType: 'cut',
        goalRate: 1.0,
      });

      return {
        dailyLogs: createMockDailyLogs(14, [70, 90]),
        trackedMeals: createMockTrackedMeals(14, {
          plan_meal: 0.6,
          fatsecret_search: 0.25,
          manual: 0.15,
        }),
        // 4 weeks of weight data with near-zero change (<0.1 lbs/week)
        weightEntries: createMockWeightEntries(4, 180, 0.05),
        mealSwaps: createMockMealSwaps(5),
        activitySyncs: createMockActivitySyncs(14, 'oura'),
        userProfile: profile,
      };
    }

    // ---- new_user ----
    case 'new_user': {
      const profile = createMockUserProfile({ goalType: 'maintain', goalRate: 0 });

      return {
        dailyLogs: createMockDailyLogs(2, [50, 80]),
        trackedMeals: createMockTrackedMeals(2, {
          plan_meal: 0.5,
          manual: 0.5,
        }),
        weightEntries: createMockWeightEntries(1, 170, 0),
        mealSwaps: [],
        activitySyncs: [],
        userProfile: profile,
      };
    }

    // ---- extreme_values ----
    case 'extreme_values': {
      const profile = createMockUserProfile();

      const logs = createMockDailyLogs(14, [10, 100]);
      // Inject edge cases: zero-calorie days and very high days
      if (logs.length >= 4) {
        logs[0].actualKcal = 0;
        logs[0].actualProteinG = 0;
        logs[0].actualCarbsG = 0;
        logs[0].actualFatG = 0;
        logs[0].adherenceScore = 0;

        logs[1].actualKcal = 5500;
        logs[1].actualProteinG = 350;
        logs[1].actualCarbsG = 600;
        logs[1].actualFatG = 200;
        logs[1].adherenceScore = 100;

        // Null adherence score
        logs[2].adherenceScore = null;

        // Exactly matching targets
        logs[3].actualKcal = logs[3].targetKcal ?? 2000;
        logs[3].actualProteinG = logs[3].targetProteinG ?? 150;
        logs[3].actualCarbsG = logs[3].targetCarbsG ?? 200;
        logs[3].actualFatG = logs[3].targetFatG ?? 65;
        logs[3].adherenceScore = 100;
      }

      // Weight entries with large swings
      const weightEntries: MockWeightEntry[] = [
        {
          id: randomUUID(),
          userId: DEFAULT_USER_ID,
          weightKg: 90.72,
          weightLbs: 200,
          logDate: daysAgoDate(21),
          notes: null,
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          userId: DEFAULT_USER_ID,
          weightKg: 86.18,
          weightLbs: 190,
          logDate: daysAgoDate(14),
          notes: null,
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          userId: DEFAULT_USER_ID,
          weightKg: 92.99,
          weightLbs: 205,
          logDate: daysAgoDate(7),
          notes: 'Water retention after vacation',
          createdAt: new Date(),
        },
      ];

      return {
        dailyLogs: logs,
        trackedMeals: createMockTrackedMeals(14, {
          plan_meal: 0.3,
          fatsecret_search: 0.2,
          manual: 0.2,
          quick_add: 0.15,
          food_scan: 0.15,
        }),
        weightEntries,
        mealSwaps: createMockMealSwaps(12, 'breakfast'),
        activitySyncs: createMockActivitySyncs(14, 'oura'),
        userProfile: profile,
      };
    }
  }
}
