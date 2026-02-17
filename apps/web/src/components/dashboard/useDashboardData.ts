'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast-store';
import { useTrackingStore, MacroTargets, MacroCurrent } from '@/lib/stores/useTrackingStore';
import type { PlanMeal } from './types';

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

export function useDashboardData() {
  const trackedMeals = useTrackingStore((state) => state.trackedMeals);
  const targets = useTrackingStore((state) => state.targets);
  const current = useTrackingStore((state) => state.current);
  const adherenceScore = useTrackingStore((state) => state.adherenceScore);
  const weeklyAverageAdherence = useTrackingStore((state) => state.weeklyAverageAdherence);
  const planId = useTrackingStore((state) => state.planId);
  const lastFetch = useTrackingStore((state) => state.lastFetch);

  const setTrackedMeals = useTrackingStore((state) => state.setTrackedMeals);
  const setCurrent = useTrackingStore((state) => state.setCurrent);
  const setTargets = useTrackingStore((state) => state.setTargets);
  const setAdherenceScore = useTrackingStore((state) => state.setAdherenceScore);
  const setWeeklyAverageAdherence = useTrackingStore((state) => state.setWeeklyAverageAdherence);
  const setPlanId = useTrackingStore((state) => state.setPlanId);
  const addTrackedMeal = useTrackingStore((state) => state.addTrackedMeal);
  const setLastFetch = useTrackingStore((state) => state.setLastFetch);

  const [todayPlanMeals, setTodayPlanMeals] = useState<PlanMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingSlot, setLoggingSlot] = useState<string | null>(null);
  const [adjustingMealId, setAdjustingMealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealToLog, setMealToLog] = useState<PlanMeal | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isTrainingDay, setIsTrainingDay] = useState(false);
  const [trainingBonusKcal, setTrainingBonusKcal] = useState(0);
  const [isPlanStale, setIsPlanStale] = useState(false);
  const [staleReason, setStaleReason] = useState<'plan_age' | 'profile_changed' | null>(null);
  const [planGeneratedAt, setPlanGeneratedAt] = useState<string | null>(null);
  const router = useRouter();

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchGenerationRef = useRef(0);
  const isLoggingRef = useRef(false);

  const fetchData = useCallback(
    async (forceRefetch = false) => {
      const storeLastFetch = useTrackingStore.getState().lastFetch;
      const now = Date.now();
      const STORE_FRESHNESS_MS = 60 * 1000;

      if (!forceRefetch && storeLastFetch && now - storeLastFetch < STORE_FRESHNESS_MS) {
        setLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const generation = ++fetchGenerationRef.current;

      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const clientDayOfWeek = new Date().getDay();
        const res = await fetch(`/api/dashboard/data?dayOfWeek=${clientDayOfWeek}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (generation !== fetchGenerationRef.current) return;
        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error('Something went wrong on our end. Please try again later.');
          }
          throw new Error('Unable to load your dashboard. Please try again.');
        }
        const json = await res.json();

        if (generation !== fetchGenerationRef.current) return;

        if (!json.hasProfile) {
          setNeedsOnboarding(true);
          router.push('/onboarding');
          return;
        }

        setTargets(
          json.macros.calories
            ? {
                calories: json.macros.calories.target,
                protein: json.macros.protein.target,
                carbs: json.macros.carbs.target,
                fat: json.macros.fat.target,
              }
            : defaultTargets
        );

        setCurrent(
          json.macros.calories
            ? {
                calories: json.macros.calories.current,
                protein: json.macros.protein.current,
                carbs: json.macros.carbs.current,
                fat: json.macros.fat.current,
              }
            : defaultCurrent
        );

        setTrackedMeals(json.trackedMeals || []);
        setAdherenceScore(json.adherenceScore ?? 0);
        setWeeklyAverageAdherence(json.weeklyAverageAdherence ?? null);
        setPlanId(json.planId || null);
        setLastFetch(now);

        setTodayPlanMeals(json.todayPlanMeals || []);
        setIsTrainingDay(json.isTrainingDay ?? false);
        setTrainingBonusKcal(json.trainingBonusKcal ?? 0);
        setIsPlanStale(json.isPlanStale ?? false);
        setStaleReason(json.staleReason ?? null);
        setPlanGeneratedAt(json.planGeneratedAt ?? null);

        setError(null);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (generation === fetchGenerationRef.current) {
            setError('Dashboard took too long to load. Please try again.');
          }
          return;
        }
        if (generation !== fetchGenerationRef.current) return;
        const message = err instanceof Error ? err.message : 'Something went wrong';
        const isFriendly =
          message.includes('Something went wrong') ||
          message.includes('Unable to') ||
          message.includes('Please try') ||
          message.includes('too long');
        setError(isFriendly ? message : 'Something went wrong. Please try again later.');
      } finally {
        clearTimeout(timeoutId);
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [
      router,
      setTargets,
      setCurrent,
      setTrackedMeals,
      setAdherenceScore,
      setWeeklyAverageAdherence,
      setPlanId,
      setLastFetch,
    ]
  );

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Handle hash scrolling for quick action links
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace('#', '');
    if (hash === 'todays-plan') {
      const element = document.getElementById('todays-plan');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [loading]);

  const openLogModal = useCallback((meal: PlanMeal) => {
    setMealToLog(meal);
  }, []);

  const closeLogModal = useCallback(() => {
    setMealToLog(null);
  }, []);

  const handleLogFromPlan = useCallback(
    async (portion: number) => {
      const currentMealToLog = mealToLog;
      if (!currentMealToLog) return;
      if (isLoggingRef.current) return;
      isLoggingRef.current = true;
      setLoggingSlot(currentMealToLog.slot);
      try {
        const res = await fetch('/api/tracking/log-from-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: useTrackingStore.getState().planId,
            dayNumber: currentMealToLog.dayNumber,
            slot: currentMealToLog.slot,
            portion,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to log meal');
        }

        const result = await res.json();
        const payload = result.data ?? result;

        if (payload.success && payload.trackedMeal) {
          addTrackedMeal({
            id: payload.trackedMeal.id,
            name: payload.trackedMeal.name,
            calories: payload.trackedMeal.calories,
            protein: payload.trackedMeal.protein,
            carbs: payload.trackedMeal.carbs,
            fat: payload.trackedMeal.fat,
            portion: payload.trackedMeal.portion || portion,
            source: payload.trackedMeal.source || 'plan_meal',
            mealSlot: payload.trackedMeal.mealSlot || currentMealToLog.slot,
            createdAt: payload.trackedMeal.createdAt || new Date().toISOString(),
          });

          setMealToLog(null);

          const mealName = payload.trackedMeal.name || currentMealToLog.name;
          toast.success(`${mealName} logged successfully`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        const isFriendly =
          msg.includes('Something went wrong') ||
          msg.includes('Unable to') ||
          msg.includes('Please try');
        const errorMsg = isFriendly
          ? msg
          : 'Something went wrong while logging your meal. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
        setMealToLog(null);
      } finally {
        setLoggingSlot(null);
        isLoggingRef.current = false;
      }
    },
    [mealToLog, addTrackedMeal]
  );

  const handleAdjustPortion = useCallback(
    async (trackedMealId: string, newPortion: number) => {
      if (isLoggingRef.current) return;
      isLoggingRef.current = true;
      setAdjustingMealId(trackedMealId);
      try {
        const res = await fetch('/api/tracking/adjust-portion', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackedMealId, newPortion }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to adjust portion');
        }

        const result = await res.json();

        if (result.success && result.trackedMeal) {
          const currentTrackedMeals = useTrackingStore.getState().trackedMeals;
          const updatedMeals = currentTrackedMeals.map((meal) =>
            meal.id === trackedMealId
              ? {
                  ...meal,
                  calories: result.trackedMeal.kcal,
                  protein: result.trackedMeal.proteinG,
                  carbs: result.trackedMeal.carbsG,
                  fat: result.trackedMeal.fatG,
                  portion: result.trackedMeal.portion,
                }
              : meal
          );
          setTrackedMeals(updatedMeals);

          setCurrent({
            calories: result.dailyTotals.actualKcal,
            protein: result.dailyTotals.actualProteinG,
            carbs: result.dailyTotals.actualCarbsG,
            fat: result.dailyTotals.actualFatG,
          });

          toast.success(`Portion adjusted to ${newPortion}x`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        const isFriendly =
          msg.includes('Something went wrong') ||
          msg.includes('Unable to') ||
          msg.includes('Please try');
        const errorMsg = isFriendly
          ? msg
          : 'Something went wrong while adjusting portion. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setAdjustingMealId(null);
        isLoggingRef.current = false;
      }
    },
    [setTrackedMeals, setCurrent]
  );

  return {
    // Store data
    trackedMeals,
    targets,
    current,
    adherenceScore,
    weeklyAverageAdherence,
    planId,
    lastFetch,
    // Local state
    todayPlanMeals,
    loading,
    loggingSlot,
    adjustingMealId,
    error,
    mealToLog,
    needsOnboarding,
    isTrainingDay,
    trainingBonusKcal,
    isPlanStale,
    staleReason,
    planGeneratedAt,
    // Actions
    setLoading,
    setError,
    fetchData,
    openLogModal,
    closeLogModal,
    handleLogFromPlan,
    handleAdjustPortion,
  };
}
