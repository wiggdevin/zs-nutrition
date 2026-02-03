"use client";

import { useEffect } from "react";

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
  ingredients?: Array<{ name: string; amount: string }>;
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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (meal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
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
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#141414] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="meal-detail-modal-content"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 border-b border-[#2a2a2a] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Slot badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded bg-[#f97316]/20 px-2 py-1 text-xs font-bold uppercase text-[#f97316]">
                  {meal.slot}
                </span>
                {meal.confidenceLevel && (
                  <span
                    className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                      meal.confidenceLevel === "verified"
                        ? "bg-[#22c55e]/20 text-[#22c55e]"
                        : "bg-[#f59e0b]/20 text-[#f59e0b]"
                    }`}
                    data-testid="meal-detail-confidence-badge"
                  >
                    {meal.confidenceLevel === "verified" ? "✓ Verified" : "⚡ AI-Estimated"}
                  </span>
                )}
              </div>

              {/* Meal name */}
              <h2
                className="text-xl sm:text-2xl font-heading font-bold uppercase tracking-wider text-[#fafafa] leading-tight"
                data-testid="meal-detail-name"
              >
                {meal.name}
              </h2>

              {/* Cuisine and time */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#a1a1aa]">
                {meal.cuisine && (
                  <span data-testid="meal-detail-cuisine">{meal.cuisine}</span>
                )}
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
              className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#a1a1aa] transition-colors hover:bg-[#2a2a2a] hover:text-[#fafafa]"
              data-testid="meal-detail-close"
              aria-label="Close meal details"
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Macro summary pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-[#f97316]/15 px-3 py-1.5 text-sm font-bold text-[#f97316]">
              {meal.nutrition.kcal} kcal
            </span>
            <span className="inline-flex items-center rounded-full bg-[#3b82f6]/15 px-3 py-1.5 text-sm font-bold text-[#3b82f6]">
              P {meal.nutrition.proteinG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-[#f59e0b]/15 px-3 py-1.5 text-sm font-bold text-[#f59e0b]">
              C {meal.nutrition.carbsG}g
            </span>
            <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-3 py-1.5 text-sm font-bold text-[#ef4444]">
              F {meal.nutrition.fatG}g
            </span>
            {meal.nutrition.fiberG && (
              <span className="inline-flex items-center rounded-full bg-[#8b5cf6]/15 px-3 py-1.5 text-sm font-bold text-[#8b5cf6]">
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] mb-3 flex items-center gap-2">
                  <span>🥄</span>
                  <span>Ingredients</span>
                </h3>
                <ul className="space-y-2">
                  {meal.ingredients!.map((ingredient, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-[#fafafa] py-2 border-b border-[#2a2a2a]/50 last:border-0"
                      data-testid={`meal-detail-ingredient-${idx}`}
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center text-xs font-bold text-[#f97316] mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{ingredient.name}</span>
                        {ingredient.amount && (
                          <span className="ml-2 text-[#a1a1aa]">({ingredient.amount})</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions section */}
            {hasInstructions && (
              <div data-testid="meal-detail-instructions-section">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] mb-3 flex items-center gap-2">
                  <span>📝</span>
                  <span>Instructions</span>
                </h3>
                <ol className="space-y-4">
                  {meal.instructions!.map((instruction, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 text-sm text-[#fafafa]"
                      data-testid={`meal-detail-instruction-${idx}`}
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#f97316] flex items-center justify-center text-xs font-bold text-[#0a0a0a]">
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
                <p className="text-sm text-[#a1a1aa]" data-testid="meal-detail-no-details">
                  No detailed recipe information available for this meal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-[#2a2a2a] px-6 py-4 bg-[#0f0f0f]">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
            data-testid="meal-detail-close-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
