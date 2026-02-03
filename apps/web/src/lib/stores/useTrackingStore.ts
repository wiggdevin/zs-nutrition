'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      name: 'zsn-tracking-store', // localStorage key
      partialize: (state) => ({
        // Only persist what we need across refreshes
        targets: state.targets,
        current: state.current,
        trackedMeals: state.trackedMeals,
        adherenceScore: state.adherenceScore,
        weeklyAverageAdherence: state.weeklyAverageAdherence,
        planId: state.planId,
        lastFetch: state.lastFetch,
        // Don't persist loading state
      }),
    }
  )
);
