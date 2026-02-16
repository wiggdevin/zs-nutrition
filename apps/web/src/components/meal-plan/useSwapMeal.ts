'use client';

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/safe-logger';
import type { PlanData, Meal, SwapTarget } from './types';

export function useSwapMeal(
  plan: PlanData | null,
  setPlan: React.Dispatch<React.SetStateAction<PlanData | null>>,
  planReplaced: boolean,
  checkPlanStatus: () => Promise<void>
) {
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<Meal[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swappingMeal, setSwappingMeal] = useState<{ dayNumber: number; mealIdx: number } | null>(
    null
  );
  const [swapSuccess, setSwapSuccess] = useState<{ dayNumber: number; mealIdx: number } | null>(
    null
  );
  const [swapError, setSwapError] = useState<string | null>(null);
  // Ref-based guard for synchronous double-click prevention (state updates are async)
  const swapLockRef = useRef(false);

  // Handle swap icon click - open modal and fetch alternatives
  const handleSwapClick = useCallback(
    async (dayNumber: number, mealIdx: number, meal: Meal) => {
      // Prevent interactions on replaced plans
      if (planReplaced) {
        await checkPlanStatus();
        if (planReplaced) {
          return;
        }
      }

      // Synchronous ref-based guard prevents double-click (state updates are async)
      if (swapLockRef.current) return;
      swapLockRef.current = true;

      setSwapTarget({ dayNumber, mealIdx, meal });
      setSwapLoading(true);
      setSwapAlternatives([]);

      try {
        const res = await fetch('/api/plan/swap/alternatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan?.id,
            dayNumber,
            slot: meal.slot,
            currentMealName: meal.name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSwapAlternatives(data.alternatives || []);
        } else if (res.status === 400) {
          const data = await res.json();
          if (data.error?.includes('not active') || data.error?.includes('replaced')) {
            await checkPlanStatus();
          }
        }
      } catch (err) {
        logger.error('Failed to fetch swap alternatives:', err);
      } finally {
        setSwapLoading(false);
        swapLockRef.current = false;
      }
    },
    [plan?.id, planReplaced, checkPlanStatus]
  );

  // Handle selecting a swap alternative with retry logic
  const handleSwapSelect = useCallback(
    async (alt: Meal) => {
      if (!swapTarget || !plan) return;

      const target = swapTarget;
      setSwapTarget(null);
      setSwapError(null);
      setSwappingMeal({ dayNumber: target.dayNumber, mealIdx: target.mealIdx });

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await fetch('/api/plan/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId: plan.id,
              dayNumber: target.dayNumber,
              slot: target.meal.slot,
              mealIdx: target.mealIdx,
              originalMeal: target.meal,
              newMeal: alt,
            }),
          });

          if (res.ok) {
            await res.json();

            // Update the plan locally
            const updatedDays = [...(plan.validatedPlan?.days || [])];
            const dayIdx = updatedDays.findIndex((d) => d.dayNumber === target.dayNumber);
            if (dayIdx !== -1 && updatedDays[dayIdx].meals[target.mealIdx]) {
              updatedDays[dayIdx].meals[target.mealIdx] = alt;
              setPlan({
                ...plan,
                validatedPlan: {
                  ...plan.validatedPlan,
                  days: updatedDays,
                },
              });
            }

            setSwapError(null);
            setTimeout(() => {
              setSwappingMeal(null);
              swapLockRef.current = false;
              setSwapSuccess({ dayNumber: target.dayNumber, mealIdx: target.mealIdx });
              setTimeout(() => {
                setSwapSuccess(null);
              }, 3000);
            }, 500);
            return;
          } else {
            const errorData = await res.json().catch(() => ({ error: res.statusText }));
            lastError = new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);

            if (attempt < MAX_RETRIES - 1) {
              logger.debug(
                `Swap attempt ${attempt + 1} failed, retrying... (${lastError.message})`
              );
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            }
          }
        } catch (err) {
          lastError = err as Error;

          if (attempt < MAX_RETRIES - 1) {
            logger.debug(
              `Swap attempt ${attempt + 1} failed with error, retrying... (${lastError.message})`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      logger.error(`Failed to swap meal after ${MAX_RETRIES} attempts:`, lastError);
      setSwapError(`Failed to swap meal after ${MAX_RETRIES} attempts. Please try again.`);

      setTimeout(() => {
        setSwappingMeal(null);
        swapLockRef.current = false;
        setTimeout(() => {
          setSwapError(null);
        }, 5000);
      }, 500);
    },
    [swapTarget, plan, setPlan]
  );

  const handleSwapClose = useCallback(() => {
    setSwapTarget(null);
    setSwapAlternatives([]);
    setSwapLoading(false);
    swapLockRef.current = false;
  }, []);

  // Handle undo swap
  const handleUndoClick = useCallback(
    async (dayNumber: number, mealIdx: number, slot: string) => {
      if (!plan || swapLockRef.current) return;

      swapLockRef.current = true;

      try {
        const res = await fetch('/api/plan/swap/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            dayNumber,
            slot,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          const updatedDays = [...(plan.validatedPlan?.days || [])];
          const dayIdx = updatedDays.findIndex((d) => d.dayNumber === dayNumber);
          if (dayIdx !== -1 && updatedDays[dayIdx].meals[mealIdx]) {
            updatedDays[dayIdx].meals[mealIdx] = data.restoredMeal;
            setPlan({
              ...plan,
              validatedPlan: {
                ...plan.validatedPlan,
                days: updatedDays,
              },
            });
          }

          setSwapSuccess(null);
        }
      } catch (err) {
        logger.error('Failed to undo swap:', err);
      } finally {
        swapLockRef.current = false;
      }
    },
    [plan, setPlan]
  );

  return {
    swapTarget,
    swapAlternatives,
    swapLoading,
    swappingMeal,
    swapSuccess,
    swapError,
    setSwapError,
    handleSwapClick,
    handleSwapSelect,
    handleSwapClose,
    handleUndoClick,
  };
}
