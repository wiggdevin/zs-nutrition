'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast-store';

interface QuickAddResult {
  success: boolean;
  trackedMeal?: {
    id: string;
    mealName: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    source: string;
  };
  dailyLog?: {
    actualKcal: number;
    actualProteinG: number;
    actualCarbsG: number;
    actualFatG: number;
    adherenceScore: number;
  };
  error?: string;
}

export default function QuickAdd() {
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [label, setLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuickAddResult | null>(null);
  const [error, setError] = useState('');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const lastPayloadRef = useRef<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    label?: string;
  } | null>(null);

  const submitEntry = useCallback(
    async (payload: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      label?: string;
    }) => {
      setIsSubmitting(true);
      setError('');
      setIsNetworkError(false);
      setResult(null);
      lastPayloadRef.current = payload;

      try {
        const res = await fetch('/api/tracking/quick-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data: QuickAddResult = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to add entry');
          setIsNetworkError(false);
          toast.error(data.error || 'Failed to add entry');
          return;
        }

        setResult(data);
        lastPayloadRef.current = null;

        // Show success toast
        if (data.success && data.trackedMeal) {
          toast.success(`${data.trackedMeal.mealName} logged successfully`);
        }

        // Reset form on success
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
        setLabel('');
      } catch (err) {
        console.error('[QuickAdd] Network error submitting quick add entry:', err);
        setError('Unable to connect. Please check your internet connection and try again.');
        setIsNetworkError(true);
        toast.error('Unable to connect. Please check your internet connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // Validate calories
    const kcal = Number(calories);
    if (!calories || isNaN(kcal) || kcal <= 0) {
      setError('Please enter a valid calorie amount (must be greater than 0)');
      return;
    }

    await submitEntry({
      calories: kcal,
      protein: protein ? Number(protein) : 0,
      carbs: carbs ? Number(carbs) : 0,
      fat: fat ? Number(fat) : 0,
      label: label || undefined,
    });
  };

  const handleRetry = async () => {
    if (lastPayloadRef.current) {
      await submitEntry(lastPayloadRef.current);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">Quick Add</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Quickly log calories and optional macros without searching for a food.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Optional Label */}
          <div>
            <label
              htmlFor="quick-add-label"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
            >
              Label <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="quick-add-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Afternoon snack"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Calories (required) */}
          <div>
            <label
              htmlFor="quick-add-calories"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
            >
              Calories <span className="text-primary">*</span>
            </label>
            <input
              id="quick-add-calories"
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="Enter calorie amount"
              min="1"
              step="1"
              required
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-lg font-semibold"
            />
          </div>

          {/* Optional Macros Row */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Macros <span className="text-muted-foreground font-normal">(optional, in grams)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="quick-add-protein"
                  className="text-xs text-blue-400 mb-1 font-medium block"
                >
                  Protein (g)
                </label>
                <input
                  id="quick-add-protein"
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors text-center"
                />
              </div>
              <div>
                <label
                  htmlFor="quick-add-carbs"
                  className="text-xs text-green-400 mb-1 font-medium block"
                >
                  Carbs (g)
                </label>
                <input
                  id="quick-add-carbs"
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors text-center"
                />
              </div>
              <div>
                <label
                  htmlFor="quick-add-fat"
                  className="text-xs text-yellow-400 mb-1 font-medium block"
                >
                  Fat (g)
                </label>
                <input
                  id="quick-add-fat"
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors text-center"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm"
              data-testid="quick-add-standalone-error"
              role="alert"
              aria-live="assertive"
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
                  <p className="text-red-400">{error}</p>
                  {isNetworkError && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSubmitting}
                      className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="quick-add-standalone-retry"
                    >
                      {isSubmitting ? (
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !calories}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground text-background font-bold rounded-xl uppercase tracking-wider transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding...
              </span>
            ) : (
              'Add Entry'
            )}
          </button>
        </form>

        {/* Success Result */}
        {result?.success && result.trackedMeal && (
          <div
            className="mt-4 bg-success/10 border border-success/30 rounded-xl p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-success text-lg">✓</span>
              <span className="text-success font-bold text-sm uppercase tracking-wider">
                Added Successfully
              </span>
            </div>
            <div className="text-foreground font-medium mb-2">{result.trackedMeal.mealName}</div>
            <div className="flex gap-3 flex-wrap">
              <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                {result.trackedMeal.kcal} kcal
              </span>
              {result.trackedMeal.proteinG > 0 && (
                <span className="px-2.5 py-1 bg-blue-400/10 text-blue-400 rounded-full text-xs font-semibold">
                  P {result.trackedMeal.proteinG}g
                </span>
              )}
              {result.trackedMeal.carbsG > 0 && (
                <span className="px-2.5 py-1 bg-green-400/10 text-green-400 rounded-full text-xs font-semibold">
                  C {result.trackedMeal.carbsG}g
                </span>
              )}
              {result.trackedMeal.fatG > 0 && (
                <span className="px-2.5 py-1 bg-yellow-400/10 text-yellow-400 rounded-full text-xs font-semibold">
                  F {result.trackedMeal.fatG}g
                </span>
              )}
            </div>
            {result.dailyLog && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                Today&apos;s total:{' '}
                <span className="text-foreground font-medium">
                  {result.dailyLog.actualKcal} kcal
                </span>{' '}
                | Adherence:{' '}
                <span className="text-foreground font-medium">
                  {result.dailyLog.adherenceScore}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
