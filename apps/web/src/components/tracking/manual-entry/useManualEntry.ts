'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast-store';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface ManualEntryFormProps {
  onSuccess?: (meal: {
    id: string;
    mealName: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => void;
}

export function useManualEntry({ onSuccess }: ManualEntryFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('');
  const [loggedDate, setLoggedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const lastSubmitPayloadRef = useRef<{
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealSlot?: MealSlot;
    loggedDate?: string;
  } | null>(null);
  const lastSubmissionTimestampRef = useRef<number>(0);

  useEffect(() => {
    const state = window.history.state;
    if (state && state.manualEntrySubmitted) {
      setSuccessMessage('This entry was already logged. Use the form to add a new entry.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, []);

  const resetForm = () => {
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMealSlot('');
    setLoggedDate(new Date().toISOString().split('T')[0]);
    setError(null);
    setFieldErrors({});
  };

  const submitEntry = useCallback(
    async (payload: {
      foodName: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      mealSlot?: MealSlot;
      loggedDate?: string;
    }) => {
      setIsSubmitting(true);
      setError(null);
      setIsNetworkError(false);
      setSuccessMessage(null);
      lastSubmitPayloadRef.current = payload;

      try {
        const res = await fetch('/api/tracking/manual-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            loggedDate: payload.loggedDate || new Date().toISOString().split('T')[0],
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to log entry');
          setIsNetworkError(false);
          toast.error(data.error || 'Failed to log entry');
          return;
        }

        setSuccessMessage(`Logged "${data.trackedMeal.mealName}" (${data.trackedMeal.kcal} kcal)`);
        lastSubmitPayloadRef.current = null;
        lastSubmissionTimestampRef.current = Date.now();

        toast.success(`${data.trackedMeal.mealName} logged successfully`);

        try {
          window.history.replaceState({ ...window.history.state, manualEntrySubmitted: true }, '');
        } catch (err) {
          console.warn('[useManualEntry] Failed to update history state:', err);
        }
        if (onSuccess) {
          onSuccess(data.trackedMeal);
        }
        resetForm();

        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        console.error('[useManualEntry] Network error submitting manual entry:', err);
        setError('Unable to connect. Please check your internet connection and try again.');
        setIsNetworkError(true);
        toast.error('Unable to connect. Please check your internet connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const now = Date.now();
    if (now - lastSubmissionTimestampRef.current < 3000) {
      setError('Entry was just logged. Please wait a moment before submitting again.');
      return;
    }

    const newFieldErrors: Record<string, string> = {};
    if (!calories || isNaN(Number(calories)) || Number(calories) < 0) {
      newFieldErrors.calories = 'Please enter a valid calorie amount (0 or more)';
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    await submitEntry({
      foodName: foodName.trim() || 'Custom food',
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      mealSlot: mealSlot || undefined,
      loggedDate: loggedDate,
    });
  };

  const handleRetry = async () => {
    if (lastSubmitPayloadRef.current) {
      await submitEntry(lastSubmitPayloadRef.current);
    }
  };

  return {
    isOpen,
    setIsOpen,
    foodName,
    setFoodName,
    calories,
    setCalories,
    protein,
    setProtein,
    carbs,
    setCarbs,
    fat,
    setFat,
    mealSlot,
    setMealSlot,
    loggedDate,
    setLoggedDate,
    isSubmitting,
    error,
    fieldErrors,
    setFieldErrors,
    isNetworkError,
    successMessage,
    handleSubmit,
    handleRetry,
    resetForm,
  };
}
