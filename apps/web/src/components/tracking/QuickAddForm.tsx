'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Block non-numeric keys on number inputs. Allows digits, navigation, and control keys. */
function numericKeyFilter(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = false) {
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

export default function QuickAddForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealSlot, setMealSlot] = useState<MealSlot | ''>('');
  const [loggedDate, setLoggedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [hasSubmittedRecently, setHasSubmittedRecently] = useState(false);
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
  const isSubmittingRef = useRef(false); // Synchronous lock to prevent concurrent submissions

  // Cross-tab coordination: listen for submissions from other tabs
  useEffect(() => {
    // On mount / back-navigation, check if we just submitted (prevent back-resubmit)
    const state = window.history.state;
    if (state && state.quickAddSubmitted) {
      setHasSubmittedRecently(true);
      setSuccessMessage('This entry was already logged. Use the form to add a new entry.');
      // Clear the flag so fresh submissions work
      setTimeout(() => {
        setHasSubmittedRecently(false);
        setSuccessMessage(null);
      }, 3000);
    }

    // BroadcastChannel for cross-tab coordination
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('zsn-quick-add-submissions');
      channel.onmessage = (event) => {
        if (event.data?.type === 'quick-add-submitted') {
          // Another tab just submitted — update our timestamp to prevent duplicate
          lastSubmissionTimestampRef.current = Date.now();
        }
      };
    } catch {
      // BroadcastChannel not supported — server-side dedup is the fallback
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

      // Notify other tabs about this submission
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
      // Mark history state to prevent back-resubmit
      try {
        window.history.replaceState({ ...window.history.state, quickAddSubmitted: true }, '');
      } catch {
        /* ignore */
      }
      // Reset form
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMealName('');
      setMealSlot('');
      setLoggedDate(new Date().toISOString().split('T')[0]); // Reset to today
      setFieldErrors({});
      // Clear success after 4s
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err) => {
      isSubmittingRef.current = false;
      // Check if it's a network/connection error
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

    // Synchronous lock to prevent concurrent submissions (across rapid clicks or tabs)
    if (isSubmittingRef.current) {
      setErrorMessage('Submission in progress. Please wait.');
      return;
    }

    // Prevent rapid duplicate submissions (within 3 seconds)
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 px-4 py-3 bg-card border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="font-medium">Quick Add</span>
        <span className="text-xs">(enter raw macros)</span>
      </button>
    );
  }

  return (
    <div className="mt-4 bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">Quick Add</h3>
        <button
          onClick={() => {
            setIsOpen(false);
            setErrorMessage(null);
            setFieldErrors({});
            setSuccessMessage(null);
            setMealSlot('');
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Optional meal name */}
        <div>
          <label
            htmlFor="quick-add-name"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
          >
            Name <span className="text-muted-foreground normal-case font-normal">(optional)</span>
          </label>
          <input
            id="quick-add-name"
            type="text"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="e.g. Protein shake, Snack bar..."
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Meal Slot Selector */}
        <div>
          <label
            htmlFor="quick-add-meal-slot"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
          >
            Meal Slot{' '}
            <span className="text-muted-foreground normal-case font-normal">(optional)</span>
          </label>
          <select
            id="quick-add-meal-slot"
            value={mealSlot}
            onChange={(e) => setMealSlot(e.target.value as MealSlot | '')}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            data-testid="quick-add-meal-slot"
          >
            <option value="">No meal slot</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>

        {/* Date Selector */}
        <div>
          <label
            htmlFor="quick-add-date"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
          >
            Date
          </label>
          <input
            id="quick-add-date"
            type="date"
            value={loggedDate}
            onChange={(e) => setLoggedDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            data-testid="quick-add-date"
          />
        </div>

        {/* Calories - required */}
        <div>
          <label
            htmlFor="quick-add-calories"
            className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1.5"
          >
            Calories <span className="text-primary">*</span>
          </label>
          <input
            id="quick-add-calories"
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => {
              setCalories(e.target.value);
              if (fieldErrors.calories) {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 10000) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.calories;
                    return next;
                  });
                }
              }
            }}
            onKeyDown={(e) => numericKeyFilter(e)}
            placeholder="Enter calories"
            min="1"
            max="10000"
            required
            aria-invalid={!!fieldErrors.calories}
            aria-describedby={fieldErrors.calories ? 'quick-add-calories-error' : undefined}
            className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors text-lg font-semibold ${
              fieldErrors.calories
                ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
            }`}
            data-testid="quick-add-calories"
          />
          {fieldErrors.calories && (
            <p
              id="quick-add-calories-error"
              className="mt-1 text-xs text-red-500"
              role="alert"
              aria-live="polite"
            >
              {fieldErrors.calories}
            </p>
          )}
        </div>

        {/* Optional macros in a row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="quick-add-protein"
              className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5"
            >
              Protein <span className="text-muted-foreground normal-case font-normal">(g)</span>
            </label>
            <input
              id="quick-add-protein"
              type="number"
              inputMode="decimal"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              onKeyDown={(e) => numericKeyFilter(e, true)}
              placeholder="0"
              min="0"
              max="1000"
              step="0.1"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              data-testid="quick-add-protein"
            />
          </div>
          <div>
            <label
              htmlFor="quick-add-carbs"
              className="block text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5"
            >
              Carbs <span className="text-muted-foreground normal-case font-normal">(g)</span>
            </label>
            <input
              id="quick-add-carbs"
              type="number"
              inputMode="decimal"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              onKeyDown={(e) => numericKeyFilter(e, true)}
              placeholder="0"
              min="0"
              max="1000"
              step="0.1"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
              data-testid="quick-add-carbs"
            />
          </div>
          <div>
            <label
              htmlFor="quick-add-fat"
              className="block text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1.5"
            >
              Fat <span className="text-muted-foreground normal-case font-normal">(g)</span>
            </label>
            <input
              id="quick-add-fat"
              type="number"
              inputMode="decimal"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              onKeyDown={(e) => numericKeyFilter(e, true)}
              placeholder="0"
              min="0"
              max="1000"
              step="0.1"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
              data-testid="quick-add-fat"
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={quickAddMutation.isPending}
          className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          data-testid="quick-add-submit"
        >
          {quickAddMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Add Entry</span>
            </>
          )}
        </button>
      </form>

      {/* Success message */}
      {successMessage && (
        <div
          className="mt-3 px-4 py-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"
          data-testid="quick-add-success"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div
          className="mt-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm"
          data-testid="quick-add-error"
        >
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-400">{errorMessage}</p>
              {isNetworkError && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={quickAddMutation.isPending}
                  className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  data-testid="quick-add-retry"
                >
                  {quickAddMutation.isPending ? (
                    <>
                      <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Retry
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
