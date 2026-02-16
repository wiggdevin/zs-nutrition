'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Block non-numeric keys on number inputs. Allows digits, navigation, and control keys. */
export function numericKeyFilter(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = false) {
  const allowed = [
    'Backspace',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Delete',
    'Home',
    'End',
    'Enter',
  ];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (allowDecimal && e.key === '.') return;
  if (e.key === '-') return;
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

export function useQuickAdd() {
  const [isOpen, setIsOpen] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('');
  const [loggedDate, setLoggedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [_hasSubmittedRecently, setHasSubmittedRecently] = useState(false);
  const lastMutationPayloadRef = useRef<{
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    mealName?: string;
    mealSlot?: MealSlot;
    loggedDate?: string;
  } | null>(null);
  const lastSubmissionTimestampRef = useRef<number>(0);
  const isSubmittingRef = useRef(false);

  // Cross-tab coordination: listen for submissions from other tabs
  useEffect(() => {
    const state = window.history.state;
    if (state && state.quickAddSubmitted) {
      setHasSubmittedRecently(true);
      setSuccessMessage('This entry was already logged. Use the form to add a new entry.');
      setTimeout(() => {
        setHasSubmittedRecently(false);
        setSuccessMessage(null);
      }, 3000);
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('zsn-quick-add-submissions');
      channel.onmessage = (event) => {
        if (event.data?.type === 'quick-add-submitted') {
          lastSubmissionTimestampRef.current = Date.now();
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      try {
        channel?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const quickAddMutation = trpc.meal.quickAdd.useMutation({
    onSuccess: (data) => {
      isSubmittingRef.current = false;
      setIsNetworkError(false);
      lastMutationPayloadRef.current = null;
      lastSubmissionTimestampRef.current = Date.now();

      try {
        const channel = new BroadcastChannel('zsn-quick-add-submissions');
        channel.postMessage({ type: 'quick-add-submitted', mealName: data.trackedMeal.mealName });
        channel.close();
      } catch {
        /* BroadcastChannel not supported */
      }

      const dupNote = data.duplicate ? ' (duplicate prevented)' : '';
      setSuccessMessage(
        `Added "${data.trackedMeal.mealName}" — ${data.trackedMeal.kcal} kcal. Today's total: ${data.dailyLog.actualKcal} kcal${dupNote}`
      );
      try {
        window.history.replaceState({ ...window.history.state, quickAddSubmitted: true }, '');
      } catch {
        /* ignore */
      }
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMealName('');
      setMealSlot('');
      setLoggedDate(new Date().toISOString().split('T')[0]);
      setFieldErrors({});
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err) => {
      isSubmittingRef.current = false;
      const msg = err.message || '';
      const isNetwork =
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('Failed to fetch') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('NetworkError') ||
        !navigator.onLine;
      if (isNetwork) {
        setErrorMessage('Unable to connect. Please check your internet connection and try again.');
        setIsNetworkError(true);
      } else {
        setErrorMessage(msg || 'Failed to add entry');
        setIsNetworkError(false);
      }
    },
  });

  const doMutate = (payload: {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    mealName?: string;
    mealSlot?: MealSlot;
    loggedDate?: string;
  }) => {
    lastMutationPayloadRef.current = payload;
    setErrorMessage(null);
    setIsNetworkError(false);
    setSuccessMessage(null);
    quickAddMutation.mutate(payload);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isSubmittingRef.current) {
      setErrorMessage('Submission in progress. Please wait.');
      return;
    }

    const now = Date.now();
    if (now - lastSubmissionTimestampRef.current < 3000) {
      setErrorMessage('Entry was just logged. Please wait a moment before submitting again.');
      return;
    }

    const cal = parseInt(calories, 10);
    const newFieldErrors: Record<string, string> = {};
    if (isNaN(cal) || cal < 1) {
      newFieldErrors.calories = 'Must be a positive number (minimum 1)';
    } else if (cal > 10000) {
      newFieldErrors.calories = 'Must be 10,000 or less';
    }
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    isSubmittingRef.current = true;
    doMutate({
      calories: cal,
      protein: protein ? parseFloat(protein) : undefined,
      carbs: carbs ? parseFloat(carbs) : undefined,
      fat: fat ? parseFloat(fat) : undefined,
      mealName: mealName.trim() || undefined,
      mealSlot: mealSlot || undefined,
      loggedDate: loggedDate,
    });
  };

  const handleRetry = () => {
    if (lastMutationPayloadRef.current) {
      doMutate(lastMutationPayloadRef.current);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setErrorMessage(null);
    setFieldErrors({});
    setSuccessMessage(null);
    setMealSlot('');
  };

  return {
    isOpen,
    setIsOpen,
    calories,
    setCalories,
    protein,
    setProtein,
    carbs,
    setCarbs,
    fat,
    setFat,
    mealName,
    setMealName,
    mealSlot,
    setMealSlot,
    loggedDate,
    setLoggedDate,
    successMessage,
    errorMessage,
    fieldErrors,
    setFieldErrors,
    isNetworkError,
    isPending: quickAddMutation.isPending,
    handleSubmit,
    handleRetry,
    handleClose,
  };
}
