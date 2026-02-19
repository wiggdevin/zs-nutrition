'use client';

import { useModal } from '@/hooks/useModal';
import { formatSlotName, formatPrepTime, isGenericInstruction } from './utils';

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
  dayNumber: _dayNumber,
  mealIdx: _mealIdx,
  onClose,
}: MealDetailModalProps) {
  const { modalRef, handleBackdropClick } = useModal(onClose);

  if (!meal) return null;

  const hasIngredients = meal.ingredients && meal.ingredients.length > 0;
  const hasInstructions = meal.instructions && meal.instructions.length > 0;
  const hasRealInstructions = hasInstructions && !isGenericInstruction(meal.instructions!);
  const timeInfo = formatPrepTime(meal.prepTimeMin, meal.cookTimeMin);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-8"
      style={{ animation: 'modalBackdropIn 0.3s ease-out' }}
      data-testid="meal-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-detail-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-xl border border-border bg-card shadow-2xl flex flex-col"
        style={{ animation: 'modalSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
        data-testid="meal-detail-modal-content"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Slot label chip + confidence badge */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    meal.slot === 'breakfast'
                      ? 'bg-warning/20 text-warning'
                      : meal.slot === 'lunch'
                        ? 'bg-chart-3/20 text-chart-3'
                        : meal.slot === 'dinner'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-chart-4/20 text-chart-4'
                  }`}
                  data-testid="meal-detail-slot-chip"
                >
                  {formatSlotName(meal.slot)}
                </span>
                {meal.confidenceLevel && meal.confidenceLevel !== 'verified' && (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning border border-warning/30"
                    data-testid="meal-detail-confidence-badge"
                  >
                    AI-Est.
                  </span>
                )}
              </div>

              {/* Meal name */}
              <h2
                id="meal-detail-title"
                className="text-xl font-heading font-bold text-foreground leading-tight"
                data-testid="meal-detail-name"
              >
                {meal.name}
              </h2>

              {/* Cuisine and time */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {meal.cuisine && <span data-testid="meal-detail-cuisine">{meal.cuisine}</span>}
                {timeInfo && (
                  <span className="flex items-center gap-1" data-testid="meal-detail-time">
                    <span>🕒</span>
                    <span>{timeInfo.total}</span>
                    {timeInfo.breakdown && <span className="text-xs">({timeInfo.breakdown})</span>}
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

                    return (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 text-sm text-foreground py-2 border-b border-border/50 last:border-0"
                        data-testid={`meal-detail-ingredient-${idx}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <span className="font-medium truncate">{ingredient.name}</span>
                        </div>
                        {amountDisplay && (
                          <span className="flex-shrink-0 text-muted-foreground text-xs font-mono">
                            {amountDisplay}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Instructions section — hide generic templates, show real recipes */}
            {hasRealInstructions ? (
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
            ) : hasInstructions ? (
              <div data-testid="meal-detail-quick-prep-tag">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>⚡</span>
                  <span>Quick prep — no recipe needed</span>
                </span>
              </div>
            ) : null}

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
