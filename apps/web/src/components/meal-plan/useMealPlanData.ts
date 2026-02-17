'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/safe-logger';
import type { PlanData, Meal } from './types';
import type { MealPlanTab } from './DayNavigator';
import { useSwapMeal } from './useSwapMeal';

export function useMealPlanData() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Meal detail modal state
  const [selectedMeal, setSelectedMeal] = useState<{
    meal: Meal;
    dayNumber: number;
    mealIdx: number;
  } | null>(null);

  // Plan replacement state
  const [planReplaced, setPlanReplaced] = useState(false);
  const [_newerPlanId, setNewerPlanId] = useState<string | null>(null);
  const planStatusCheckRef = useRef<AbortController | null>(null);

  // Track the current fetch request so we can abort stale ones
  const planAbortRef = useRef<AbortController | null>(null);
  const planFetchGenRef = useRef(0);

  // Tab view state
  const [activeTab, setActiveTab] = useState<MealPlanTab>('meal-plan');

  const fetchPlan = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (planAbortRef.current) {
      planAbortRef.current.abort();
    }
    const controller = new AbortController();
    planAbortRef.current = controller;
    const generation = ++planFetchGenRef.current;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plan/active', { signal: controller.signal });
      // If a newer fetch was started, discard this stale response
      if (generation !== planFetchGenRef.current) return;
      const data = await res.json();
      if (generation !== planFetchGenRef.current) return;

      if (res.ok && data.hasActivePlan) {
        setPlan(data.plan);
      } else {
        setError(data.error || 'No active meal plan found');
      }
    } catch (err) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (generation !== planFetchGenRef.current) return;
      logger.error('Error fetching meal plan:', err);
      setError('Failed to load meal plan. Please check your connection and try again.');
    } finally {
      if (generation === planFetchGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Check if the current plan has been replaced (called when window regains focus)
  const checkPlanStatus = useCallback(async () => {
    if (!plan?.id) return;

    // Abort any in-flight status check
    if (planStatusCheckRef.current) {
      planStatusCheckRef.current.abort();
    }

    const controller = new AbortController();
    planStatusCheckRef.current = controller;

    try {
      const res = await fetch(`/api/plan/${plan.id}/status`, {
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isReplaced || data.hasNewerPlan) {
          setPlanReplaced(true);
          setNewerPlanId(data.newerPlanId);
        }
      }
    } catch (err) {
      // Ignore aborted requests and errors - this is a non-critical check
      if (err instanceof DOMException && err.name === 'AbortError') return;
      logger.debug('Error checking plan status (non-critical):', err);
    }
  }, [plan?.id]);

  useEffect(() => {
    fetchPlan();
    // Cleanup: abort any in-flight request when component unmounts
    return () => {
      if (planAbortRef.current) {
        planAbortRef.current.abort();
      }
      if (planStatusCheckRef.current) {
        planStatusCheckRef.current.abort();
      }
    };
  }, [fetchPlan]);

  // Check plan status when window regains focus (user switched back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && plan && !planReplaced) {
        checkPlanStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [plan, planReplaced, checkPlanStatus]);

  // Swap meal functionality (extracted hook)
  const swap = useSwapMeal(plan, setPlan, planReplaced, checkPlanStatus);

  // Handle dismissing the plan replaced banner
  const handleDismissReplacedBanner = useCallback(() => {
    setPlanReplaced(false);
  }, []);

  // Handle viewing the newer plan
  const handleViewNewerPlan = useCallback(() => {
    // Reload the page which will fetch the active plan
    window.location.reload();
  }, []);

  return {
    plan,
    loading,
    error,
    activeTab,
    setActiveTab,
    selectedMeal,
    setSelectedMeal,
    planReplaced,
    fetchPlan,
    handleDismissReplacedBanner,
    handleViewNewerPlan,
    ...swap,
  };
}
