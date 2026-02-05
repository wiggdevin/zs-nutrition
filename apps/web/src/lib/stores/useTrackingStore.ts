'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { safeStorage } from './storage';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroCurrent {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface TrackedMealEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number; // Portion multiplier (e.g., 1.0, 1.5, 2.0)
  source: 'plan_meal' | 'fatsecret_search' | 'quick_add' | 'manual';
  mealSlot: string | null;
  createdAt: string;
}

export interface DailyLogState {
  // ── Data ────────────────────────────────────────────────────────────────
  targets: MacroTargets;
  current: MacroCurrent;
  trackedMeals: TrackedMealEntry[];
  adherenceScore: number;
  weeklyAverageAdherence: number | null;
  isLoading: boolean;
  lastFetch: number | null; // timestamp of last server fetch
  planId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  setTargets: (targets: MacroTargets) => void;
  setCurrent: (current: MacroCurrent) => void;
  updateMacros: (calories: number, protein: number, carbs: number, fat: number) => void;
  setTrackedMeals: (meals: TrackedMealEntry[]) => void;
  addTrackedMeal: (meal: TrackedMealEntry) => void;
  removeTrackedMeal: (mealId: string) => void;
  updateTrackedMealPortion: (mealId: string, newPortion: number, newNutrition: { calories: number; protein: number; carbs: number; fat: number }) => void;
  setAdherenceScore: (score: number) => void;
  setWeeklyAverageAdherence: (score: number | null) => void;
  setIsLoading: (loading: boolean) => void;
  setLastFetch: (timestamp: number) => void;
  setPlanId: (planId: string | null) => void;

  // ── Computed helpers ────────────────────────────────────────────────────
  getRemainingCalories: () => number;
  getRemainingProtein: () => number;
  reset: () => void;
}

// ── Default values ─────────────────────────────────────────────────────────

const defaultTargets: MacroTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

const defaultCurrent: MacroCurrent = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

// ── Persisted state schema ─────────────────────────────────────────────────

const macroSchema = z.object({
  calories: z.number().catch(0),
  protein: z.number().catch(0),
  carbs: z.number().catch(0),
  fat: z.number().catch(0),
});

const trackedMealEntrySchema = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
  calories: z.number().catch(0),
  protein: z.number().catch(0),
  carbs: z.number().catch(0),
  fat: z.number().catch(0),
  portion: z.number().catch(1),
  source: z.enum(['plan_meal', 'fatsecret_search', 'quick_add', 'manual']).catch('manual'),
  mealSlot: z.string().nullable().catch(null),
  createdAt: z.string().catch(''),
});

const trackingPersistedSchema = z.object({
  targets: macroSchema.catch(defaultTargets),
  current: macroSchema.catch(defaultCurrent),
  trackedMeals: z.array(trackedMealEntrySchema).catch([]),
  adherenceScore: z.number().catch(0),
  weeklyAverageAdherence: z.number().nullable().catch(null),
  planId: z.string().nullable().catch(null),
  lastFetch: z.number().nullable().catch(null),
});

// ── Store ──────────────────────────────────────────────────────────────────

export const useTrackingStore = create<DailyLogState>()(
  persist(
    (set, get) => ({
      // Initial state
      targets: defaultTargets,
      current: defaultCurrent,
      trackedMeals: [],
      adherenceScore: 0,
      weeklyAverageAdherence: null,
      isLoading: false,
      lastFetch: null,
      planId: null,

      // Actions
      setTargets: (targets) => set({ targets }),

      setCurrent: (current) => set({ current }),

      updateMacros: (calories, protein, carbs, fat) =>
        set({ current: { calories, protein, carbs, fat } }),

      setTrackedMeals: (meals) => set({ trackedMeals: meals }),

      addTrackedMeal: (meal) =>
        set((state) => ({
          trackedMeals: [...state.trackedMeals, meal],
          current: {
            calories: state.current.calories + meal.calories,
            protein: state.current.protein + meal.protein,
            carbs: state.current.carbs + meal.carbs,
            fat: state.current.fat + meal.fat,
          },
        })),

      removeTrackedMeal: (mealId) =>
        set((state) => {
          const mealToRemove = state.trackedMeals.find((m) => m.id === mealId);
          if (!mealToRemove) return state;

          return {
            trackedMeals: state.trackedMeals.filter((m) => m.id !== mealId),
            current: {
              calories: Math.max(0, state.current.calories - mealToRemove.calories),
              protein: Math.max(0, state.current.protein - mealToRemove.protein),
              carbs: Math.max(0, state.current.carbs - mealToRemove.carbs),
              fat: Math.max(0, state.current.fat - mealToRemove.fat),
            },
          };
        }),

      updateTrackedMealPortion: (mealId, newPortion, newNutrition) =>
        set((state) => {
          const mealToUpdate = state.trackedMeals.find((m) => m.id === mealId);
          if (!mealToUpdate) return state;

          // Calculate the difference in nutrition
          const calorieDiff = newNutrition.calories - mealToUpdate.calories;
          const proteinDiff = newNutrition.protein - mealToUpdate.protein;
          const carbsDiff = newNutrition.carbs - mealToUpdate.carbs;
          const fatDiff = newNutrition.fat - mealToUpdate.fat;

          return {
            trackedMeals: state.trackedMeals.map((m) =>
              m.id === mealId
                ? { ...m, portion: newPortion, ...newNutrition }
                : m
            ),
            current: {
              calories: state.current.calories + calorieDiff,
              protein: state.current.protein + proteinDiff,
              carbs: state.current.carbs + carbsDiff,
              fat: state.current.fat + fatDiff,
            },
          };
        }),

      setAdherenceScore: (score) => set({ adherenceScore: score }),

      setWeeklyAverageAdherence: (score) => set({ weeklyAverageAdherence: score }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      setLastFetch: (timestamp) => set({ lastFetch: timestamp }),

      setPlanId: (planId) => set({ planId }),

      // Computed helpers
      getRemainingCalories: () => {
        const state = get();
        return Math.max(0, state.targets.calories - state.current.calories);
      },

      getRemainingProtein: () => {
        const state = get();
        return Math.max(0, state.targets.protein - state.current.protein);
      },

      reset: () =>
        set({
          targets: defaultTargets,
          current: defaultCurrent,
          trackedMeals: [],
          adherenceScore: 0,
          weeklyAverageAdherence: null,
          isLoading: false,
          lastFetch: null,
          planId: null,
        }),
    }),
    {
      name: 'zsn-tracking-store',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        targets: state.targets,
        current: state.current,
        trackedMeals: state.trackedMeals,
        adherenceScore: state.adherenceScore,
        weeklyAverageAdherence: state.weeklyAverageAdherence,
        planId: state.planId,
        lastFetch: state.lastFetch,
      }),
      migrate: (persisted: unknown) => {
        const parsed = trackingPersistedSchema.safeParse(persisted);
        if (!parsed.success) {
          console.warn('[TrackingStore] Migration failed, resetting to defaults:', parsed.error);
          return {
            targets: defaultTargets,
            current: defaultCurrent,
            trackedMeals: [],
            adherenceScore: 0,
            weeklyAverageAdherence: null,
            planId: null,
            lastFetch: null,
          };
        }
        return parsed.data;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.warn('[TrackingStore] Rehydration error:', error);
          }
        };
      },
    }
  )
);
