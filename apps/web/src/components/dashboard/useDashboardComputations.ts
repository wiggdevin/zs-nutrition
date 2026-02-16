'use client';

import { useMemo, useCallback } from 'react';
import type { MacroTargets, MacroCurrent, TrackedMealEntry } from '@/lib/stores/useTrackingStore';

export interface MacroData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export interface RemainingBudget {
  calories: number;
  protein: number;
}

export function useDashboardComputations(
  current: MacroCurrent,
  targets: MacroTargets,
  trackedMeals: TrackedMealEntry[]
) {
  const macros: MacroData = useMemo(
    () => ({
      calories: { current: current.calories, target: targets.calories },
      protein: { current: current.protein, target: targets.protein },
      carbs: { current: current.carbs, target: targets.carbs },
      fat: { current: current.fat, target: targets.fat },
    }),
    [current, targets]
  );

  const remaining: RemainingBudget = useMemo(
    () => ({
      calories: macros.calories.target - macros.calories.current,
      protein: macros.protein.target - macros.protein.current,
    }),
    [macros]
  );

  const isOverCalories = remaining.calories < 0;
  const isOverProtein = remaining.protein < 0;

  const loggedSlots = useMemo(
    () =>
      new Set(
        trackedMeals
          .filter((tm) => tm.source === 'plan_meal')
          .map((tm) => tm.mealSlot?.toLowerCase())
      ),
    [trackedMeals]
  );

  const formatTime = useCallback((isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, []);

  const hasNoPlan = (planId: string | null, todayPlanMealsLength: number) =>
    !planId && todayPlanMealsLength === 0 && trackedMeals.length === 0;

  return {
    macros,
    remaining,
    isOverCalories,
    isOverProtein,
    loggedSlots,
    formatTime,
    hasNoPlan,
  };
}
