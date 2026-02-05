'use client';

import { useEffect } from 'react';

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

interface Meal {
  slot: string;
  name: string;
  cuisine?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  nutrition: MealNutrition;
  confidenceLevel?: string;
  ingredients?: Array<{
    name: string;
    amount: number | string; // Support both old (string) and new (number) formats
    unit?: string;
    fatsecretFoodId?: string;
  }>;
  instructions?: string[];
}

interface MealDetailModalProps {
  meal: Meal | null;
  dayNumber?: number;
  mealIdx?: number;
  onClose: () => void;
}

export default function MealDetailModal({
  meal,
  dayNumber,
  mealIdx,
  onClose,
}: MealDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (meal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [meal]);

  if (!meal) return null;

  const hasIngredients = meal.ingredients && meal.ingredients.length > 0;
  const hasInstructions = meal.instructions && meal.instructions.length > 0;
  const totalMinutes = (meal.prepTimeMin || 0) + (meal.cookTimeMin || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-8"
      data-testid="meal-detail-modal"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="meal-detail-modal-content"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Breadcrumb navigation */}
              <nav
                className="flex items-center gap-2 mb-3"
                aria-label="Breadcrumb"
                data-testid="meal-detail-breadcrumb"
              >
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 rounded"
                  data-testid="breadcrumb-back"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 12H5M12 19L5 12L12 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Meal Plan</span>
                </button>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-muted-foreground"
                  aria-hidden="true"
                >
                  <path
                    d="M9 5L5 9M5 5L9 9M19 19L15 15M15 19L19 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-xs font-medium text-foreground truncate max-w-[200px]"
                  data-testid="breadcrumb-current"
                >
                  {meal.name}
                </span>
              </nav>

              {/* Slot badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded bg-primary/20 px-2 py-1 text-xs font-bold uppercase text-primary">
                  {meal.slot}
                </span>
                {meal.confidenceLevel && (
                  <span
                    className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                      meal.confidenceLevel === 'verified'
                        ? 'bg-success/20 text-success'
                        : 'bg-warning/20 text-warning'
                    }`}
                    data-testid="meal-detail-confidence-badge"
                  >
                    {meal.confidenceLevel === 'verified' ? '✓ Verified' : '⚡ AI-Estimated'}
                  </span>
                )}
              </div>

              {/* Meal name */}
              <h2
                className="text-xl sm:text-2xl font-heading font-bold uppercase tracking-wider text-foreground leading-tight"
                data-testid="meal-detail-name"
              >
                {meal.name}
              </h2>

              {/* Cuisine and time */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {meal.cuisine && <span data-testid="meal-detail-cuisine">{meal.cuisine}</span>}
                {totalMinutes > 0 && (
                  <span className="flex items-center gap-1" data-testid="meal-detail-time">
                    <span>🕒</span>
                    <span>{totalMinutes} minutes</span>
                    {meal.prepTimeMin && meal.cookTimeMin && (
                      <span className="text-xs">
                        ({meal.prepTimeMin}m prep + {meal.cookTimeMin}m cook)
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
              data-testid="meal-detail-close"
              aria-label="Close meal details"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L13 13M1 13L13 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Macro summary pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1.5 text-sm font-bold text-primary">
              {meal.nutrition.kcal} kcal
            </span>
            <span className="inline-flex items-center rounded-full bg-chart-3/15 px-3 py-1.5 text-sm font-bold text-chart-3">
              P {meal.nutrition.proteinG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-warning/15 px-3 py-1.5 text-sm font-bold text-warning">
              C {meal.nutrition.carbsG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-destructive/15 px-3 py-1.5 text-sm font-bold text-destructive">
              F {meal.nutrition.fatG}g
            </span>
            {meal.nutrition.fiberG && (
              <span className="inline-flex items-center rounded-full bg-chart-4/15 px-3 py-1.5 text-sm font-bold text-chart-4">
                Fiber {meal.nutrition.fiberG}g
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* Ingredients section */}
            {hasIngredients && (
              <div data-testid="meal-detail-ingredients-section">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                  <span>🥄</span>
                  <span>Ingredients</span>
                </h3>
                <ul className="space-y-2">
                  {meal.ingredients!.map((ingredient, idx) => {
                    // Handle both old format (amount as string) and new format (amount as number + unit)
                    let amountDisplay = '';
                    if (typeof ingredient.amount === 'string') {
                      // Old format: amount is already combined (e.g., "200g")
                      amountDisplay = ingredient.amount;
                    } else if (typeof ingredient.amount === 'number') {
                      // New format: separate amount and unit
                      amountDisplay = `${ingredient.amount}${ingredient.unit || ''}`;
                    }

                    const isVerified = !!ingredient.fatsecretFoodId;

                    return (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-sm text-foreground py-2 border-b border-border/50 last:border-0"
                        data-testid={`meal-detail-ingredient-${idx}`}
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{ingredient.name}</span>
                            {isVerified && (
                              <span
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-success/20 text-success"
                                data-testid={`ingredient-verified-badge-${idx}`}
                              >
                                ✓ Verified
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {amountDisplay && (
                              <span className="text-muted-foreground">({amountDisplay})</span>
                            )}
                            {ingredient.fatsecretFoodId && (
                              <span
                                className="text-xs text-muted-foreground bg-border px-1.5 py-0.5 rounded"
                                data-testid={`ingredient-fatsecret-id-${idx}`}
                              >
                                FS: {ingredient.fatsecretFoodId}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Instructions section */}
            {hasInstructions && (
              <div data-testid="meal-detail-instructions-section">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                  <span>📝</span>
                  <span>Instructions</span>
                </h3>
                <ol className="space-y-4">
                  {meal.instructions!.map((instruction, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 text-sm text-foreground"
                      data-testid={`meal-detail-instruction-${idx}`}
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-background">
                        {idx + 1}
                      </span>
                      <p className="flex-1 leading-relaxed">{instruction}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* No details available message */}
            {!hasIngredients && !hasInstructions && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground" data-testid="meal-detail-no-details">
                  No detailed recipe information available for this meal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 bg-background">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
            data-testid="meal-detail-close-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
