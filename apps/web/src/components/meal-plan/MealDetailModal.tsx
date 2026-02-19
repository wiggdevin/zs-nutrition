'use client';

import { useState } from 'react';
import { useModal } from '@/hooks/useModal';
import { trpc } from '@/lib/trpc';
import { toast } from '@/lib/toast-store';
import {
  formatSlotName,
  formatPrepTime,
  isGenericInstruction,
  calculateMacroPercentages,
  cleanIngredientName,
} from './utils';

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
  planId?: string;
  onSwapClick?: (dayNumber: number, mealIdx: number, meal: Meal) => void;
  onClose: () => void;
}

export default function MealDetailModal({
  meal,
  dayNumber,
  mealIdx,
  planId,
  onSwapClick,
  onClose,
}: MealDetailModalProps) {
  const { modalRef, handleBackdropClick } = useModal(onClose);
  const [isLogging, setIsLogging] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const logMealMutation = trpc.meal.logMealFromPlan.useMutation({
    onSuccess: (data) => {
      setIsLogging(false);
      setIsLogged(true);
      const dupNote = data.duplicate ? ' (already logged)' : '';
      toast.success(`${meal!.name} logged — ${data.trackedMeal.kcal} kcal${dupNote}`);
    },
    onError: (err) => {
      setIsLogging(false);
      toast.error(err.message || 'Failed to log meal');
    },
  });

  if (!meal) return null;

  const hasIngredients = meal.ingredients && meal.ingredients.length > 0;
  const hasInstructions = meal.instructions && meal.instructions.length > 0;
  const hasRealInstructions = hasInstructions && !isGenericInstruction(meal.instructions!);
  const timeInfo = formatPrepTime(meal.prepTimeMin, meal.cookTimeMin);

  const canSwap = onSwapClick && dayNumber !== undefined && mealIdx !== undefined;
  const canLog = planId && dayNumber !== undefined;

  const handleSwap = () => {
    if (!canSwap) return;
    onClose();
    onSwapClick(dayNumber, mealIdx, meal);
  };

  const handleLog = () => {
    if (!canLog || isLogging || isLogged) return;
    setIsLogging(true);
    logMealMutation.mutate({
      planId: planId!,
      dayNumber: dayNumber!,
      slot: meal.slot,
      mealName: meal.name,
      calories: meal.nutrition.kcal,
      protein: meal.nutrition.proteinG,
      carbs: meal.nutrition.carbsG,
      fat: meal.nutrition.fatG,
      fiber: meal.nutrition.fiberG,
    });
  };

  const handleFavorite = () => {
    setIsFavorite((prev) => !prev);
    toast.info(!isFavorite ? 'Saved to favorites' : 'Removed from favorites');
  };

  // Action buttons rendered in both desktop left column and mobile footer
  const actionButtons = (
    <div className="flex items-center gap-3">
      {canSwap && (
        <button
          onClick={handleSwap}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-muted"
          data-testid="meal-detail-swap-button"
          aria-label="Swap this meal for an alternative"
        >
          Swap Meal
        </button>
      )}

      {canLog ? (
        <button
          onClick={handleLog}
          disabled={isLogging || isLogged}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
            isLogged
              ? 'bg-chart-3/20 text-chart-3 cursor-default'
              : isLogging
                ? 'bg-primary/70 text-background cursor-wait'
                : 'bg-primary text-background hover:bg-primary/90'
          }`}
          data-testid="meal-detail-log-button"
          aria-label={isLogged ? 'Meal already logged' : 'Log this meal as eaten'}
        >
          {isLogged ? '\u2713 Logged' : isLogging ? 'Logging...' : 'Log This Meal'}
        </button>
      ) : (
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
          data-testid="meal-detail-close-button"
        >
          Close
        </button>
      )}

      <button
        onClick={handleFavorite}
        className={`flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-lg border transition-colors ${
          isFavorite
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        data-testid="meal-detail-favorite-button"
        aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
        aria-pressed={isFavorite}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>
  );

  // Macro breakdown bar
  const pct = calculateMacroPercentages(
    meal.nutrition.proteinG,
    meal.nutrition.carbsG,
    meal.nutrition.fatG
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-0 sm:px-4 py-0 sm:py-8"
      style={{ animation: 'modalBackdropIn 0.3s ease-out' }}
      data-testid="meal-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-detail-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl md:max-w-5xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-xl border border-border bg-card shadow-2xl flex flex-col"
        style={{ animation: 'modalSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
        data-testid="meal-detail-modal-content"
      >
        {/* Close button - absolutely positioned */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
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

        {/* Responsive layout: single column on mobile, two columns on desktop */}
        <div className="flex-1 flex flex-col md:grid md:grid-cols-[2fr_3fr] min-h-0 overflow-hidden">
          {/* Left column (desktop) / Header section (mobile) */}
          <div className="flex-shrink-0 md:flex md:flex-col md:overflow-y-auto border-b border-border md:border-b-0 md:border-r md:border-border">
            <div className="px-6 py-5 pr-16">
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

              {/* Macro breakdown bar */}
              <div className="mt-4" data-testid="meal-detail-macro-bar">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-foreground">
                    {meal.nutrition.kcal} kcal
                  </span>
                  {meal.nutrition.fiberG ? (
                    <span className="text-xs text-muted-foreground">
                      · {meal.nutrition.fiberG}g fiber
                    </span>
                  ) : null}
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {pct.protein > 0 && (
                    <div
                      className="bg-chart-3 transition-all duration-500"
                      style={{ width: `${pct.protein}%` }}
                    />
                  )}
                  {pct.carbs > 0 && (
                    <div
                      className="bg-warning transition-all duration-500"
                      style={{ width: `${pct.carbs}%` }}
                    />
                  )}
                  {pct.fat > 0 && (
                    <div
                      className="bg-destructive transition-all duration-500"
                      style={{ width: `${pct.fat}%` }}
                    />
                  )}
                </div>
                <div className="mt-1.5 flex justify-between text-xs font-semibold">
                  <span className="text-chart-3">
                    P {meal.nutrition.proteinG}g
                    <span className="font-normal text-muted-foreground ml-0.5">
                      ({pct.protein}%)
                    </span>
                  </span>
                  <span className="text-warning">
                    C {meal.nutrition.carbsG}g
                    <span className="font-normal text-muted-foreground ml-0.5">({pct.carbs}%)</span>
                  </span>
                  <span className="text-destructive">
                    F {meal.nutrition.fatG}g
                    <span className="font-normal text-muted-foreground ml-0.5">({pct.fat}%)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop-only action buttons at bottom of left column */}
            <div className="hidden md:block mt-auto flex-shrink-0 border-t border-border px-6 py-4 bg-background">
              {actionButtons}
            </div>
          </div>

          {/* Right column (desktop) / Scrollable content (mobile) */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
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
                            <span className="font-medium truncate">
                              {cleanIngredientName(ingredient.name)}
                            </span>
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
        </div>

        {/* Mobile-only sticky footer with action buttons */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 bg-background md:hidden safe-area-bottom">
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
