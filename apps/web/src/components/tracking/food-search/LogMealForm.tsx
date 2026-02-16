'use client';

import type { MealSlot, FoodServing } from './types';

interface LogMealFormProps {
  currentServing: FoodServing;
  quantity: number;
  mealSlot: MealSlot | '';
  loggedDate: string;
  isLogging: boolean;
  logSuccess: string | null;
  logError: string | null;
  isLogNetworkError: boolean;
  onQuantityChange: (qty: number) => void;
  onMealSlotChange: (slot: MealSlot | '') => void;
  onDateChange: (date: string) => void;
  onLogFood: () => void;
}

export function LogMealForm({
  currentServing,
  quantity,
  mealSlot,
  loggedDate,
  isLogging,
  logSuccess,
  logError,
  isLogNetworkError,
  onQuantityChange,
  onMealSlotChange,
  onDateChange,
  onLogFood,
}: LogMealFormProps) {
  return (
    <>
      {/* Meal Slot Selector */}
      <div className="mt-4">
        <label
          htmlFor="food-meal-slot"
          className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
        >
          Meal Slot{' '}
          <span className="text-muted-foreground normal-case font-normal">(optional)</span>
        </label>
        <select
          id="food-meal-slot"
          value={mealSlot}
          onChange={(e) => onMealSlotChange(e.target.value as MealSlot | '')}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          data-testid="food-meal-slot"
        >
          <option value="">No meal slot</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {/* Date Selector */}
      <div className="mt-4">
        <label
          htmlFor="food-date"
          className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
        >
          Date
        </label>
        <input
          id="food-date"
          type="date"
          value={loggedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          data-testid="food-date"
        />
      </div>

      {/* Quantity Selector and Log Button */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          {/* Quantity Input */}
          <div className="flex-shrink-0">
            <label
              htmlFor="food-quantity"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
            >
              Quantity
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onQuantityChange(Math.max(0.5, quantity - 0.5))}
                className="w-8 h-10 flex items-center justify-center bg-secondary text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors text-lg font-bold"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <input
                id="food-quantity"
                type="number"
                value={quantity}
                onChange={(e) => onQuantityChange(Math.max(0.1, Number(e.target.value) || 0.1))}
                step="0.5"
                min="0.1"
                className="w-16 h-10 text-center bg-secondary border border-border rounded-lg text-foreground font-semibold focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => onQuantityChange(quantity + 0.5)}
                className="w-8 h-10 flex items-center justify-center bg-secondary text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors text-lg font-bold"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Adjusted Totals Preview */}
          {quantity !== 1 && (
            <div className="flex-1 min-w-0 text-sm text-muted-foreground">
              <span className="text-primary font-semibold">
                {Math.round(currentServing.calories * quantity)}
              </span>{' '}
              kcal
              {' · '}
              <span className="text-blue-400 font-semibold">
                {Math.round(currentServing.protein * quantity * 10) / 10}g
              </span>{' '}
              P{' · '}
              <span className="text-green-400 font-semibold">
                {Math.round(currentServing.carbohydrate * quantity * 10) / 10}g
              </span>{' '}
              C{' · '}
              <span className="text-yellow-400 font-semibold">
                {Math.round(currentServing.fat * quantity * 10) / 10}g
              </span>{' '}
              F
            </div>
          )}

          {/* Log Food Button */}
          <button
            onClick={onLogFood}
            disabled={isLogging}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-primary text-background font-bold uppercase tracking-wider rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLogging ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Log Food
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {logSuccess && (
        <div
          className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400"
          role="status"
          aria-live="polite"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">{logSuccess}</span>
        </div>
      )}

      {/* Error Message */}
      {logError && (
        <div
          className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
          data-testid="food-search-log-error"
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
              <span className="text-sm font-medium text-red-400">{logError}</span>
              {isLogNetworkError && (
                <button
                  type="button"
                  onClick={onLogFood}
                  disabled={isLogging}
                  className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  data-testid="food-search-retry"
                >
                  {isLogging ? (
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
    </>
  );
}
