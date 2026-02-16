'use client';

import { useManualEntry } from './useManualEntry';
import NutritionInputs from './NutritionInputs';
import type { ManualEntryFormProps, MealSlot } from './useManualEntry';

export default function ManualEntryForm({ onSuccess }: ManualEntryFormProps) {
  const {
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
  } = useManualEntry({ onSuccess });

  return (
    <div className="w-full">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-3 px-4 bg-card border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          data-testid="manual-entry-toggle"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Food Manually
        </button>
      )}

      {/* Manual Entry Form */}
      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-5"
          data-testid="manual-entry-form"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Manual Entry</h3>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              aria-label="Close manual entry form"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Food Name */}
          <div className="mb-4">
            <label
              htmlFor="manual-food-name"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
            >
              Food Name *
            </label>
            <input
              id="manual-food-name"
              type="text"
              value={foodName}
              onChange={(e) => {
                setFoodName(e.target.value);
                if (fieldErrors.foodName && e.target.value.trim()) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.foodName;
                    return next;
                  });
                }
              }}
              placeholder="e.g. Grilled Chicken Breast"
              aria-invalid={!!fieldErrors.foodName}
              aria-describedby={fieldErrors.foodName ? 'manual-food-name-error' : undefined}
              className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors ${
                fieldErrors.foodName
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
              data-testid="manual-food-name"
              autoComplete="off"
            />
            {fieldErrors.foodName && (
              <p
                id="manual-food-name-error"
                className="mt-1 text-xs text-red-500"
                role="alert"
                aria-live="polite"
              >
                {fieldErrors.foodName}
              </p>
            )}
          </div>

          {/* Meal Slot Selector */}
          <div className="mb-4">
            <label
              htmlFor="manual-meal-slot"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
            >
              Meal Slot{' '}
              <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </label>
            <select
              id="manual-meal-slot"
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value as MealSlot | '')}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="manual-meal-slot"
            >
              <option value="">No meal slot</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          {/* Date Selector */}
          <div className="mb-4">
            <label
              htmlFor="manual-date"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"
            >
              Date
            </label>
            <input
              id="manual-date"
              type="date"
              value={loggedDate}
              onChange={(e) => setLoggedDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              data-testid="manual-date"
            />
          </div>

          <NutritionInputs
            calories={calories}
            setCalories={setCalories}
            protein={protein}
            setProtein={setProtein}
            carbs={carbs}
            setCarbs={setCarbs}
            fat={fat}
            setFat={setFat}
            fieldErrors={fieldErrors}
            setFieldErrors={setFieldErrors}
          />

          {/* Error Message */}
          {error && (
            <div
              className="mb-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm"
              data-testid="manual-entry-error"
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
                  <p className="text-red-300">{error}</p>
                  {isNetworkError && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSubmitting}
                      className="mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 hover:text-red-200 font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      data-testid="manual-entry-retry"
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

          {/* Success Message */}
          {successMessage && (
            <div
              className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2"
              data-testid="manual-entry-success"
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
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="manual-entry-submit"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Log Entry
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
