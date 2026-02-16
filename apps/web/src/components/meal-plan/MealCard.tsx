'use client';

import { useCallback } from 'react';
import type { PlanDay, Meal } from './types';

/** Skeleton loader that replaces a meal card during swap */
export function MealCardSkeleton() {
  return (
    <div
      className="rounded-lg border border-border card-elevation p-3"
      data-testid="meal-swap-skeleton"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4.5 w-16 rounded-md skeleton-shimmer" />
        <div className="h-3.5 w-14 rounded-md skeleton-shimmer" />
      </div>
      <div className="h-4 w-3/4 rounded skeleton-shimmer mt-1" />
      <div className="h-3 w-1/2 rounded skeleton-shimmer mt-2" />
      <div className="mt-2.5 flex gap-1.5">
        <div className="h-5 w-14 rounded-full skeleton-shimmer" />
        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
        <div className="h-5 w-10 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

interface DayColumnProps {
  day: PlanDay;
  swappingMeal: { dayNumber: number; mealIdx: number } | null;
  swapSuccess: { dayNumber: number; mealIdx: number } | null;
  swapInProgress: boolean;
  onSwapClick: (dayNumber: number, mealIdx: number, meal: Meal) => void;
  onMealClick: (dayNumber: number, mealIdx: number, meal: Meal) => void;
  onUndoClick: (dayNumber: number, mealIdx: number, slot: string) => void;
}

export function DayColumn({
  day,
  swappingMeal,
  swapSuccess,
  swapInProgress,
  onSwapClick,
  onMealClick,
  onUndoClick,
}: DayColumnProps) {
  // Handle keyboard navigation for meal cards
  const handleMealKeyDown = useCallback(
    (e: React.KeyboardEvent, dayNumber: number, mealIdx: number, meal: Meal) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onMealClick(dayNumber, mealIdx, meal);
      }
    },
    [onMealClick]
  );
  const dayTotalKcal = day.meals.reduce((sum, m) => sum + m.nutrition.kcal, 0);
  const dayTotalProtein = day.meals.reduce((sum, m) => sum + m.nutrition.proteinG, 0);
  const dayTotalCarbs = day.meals.reduce((sum, m) => sum + m.nutrition.carbsG, 0);
  const dayTotalFat = day.meals.reduce((sum, m) => sum + m.nutrition.fatG, 0);

  return (
    <div
      className="flex flex-col rounded-lg border border-border card-elevation overflow-hidden"
      data-testid={`day-column-${day.dayNumber}`}
    >
      {/* Day header - prominent and distinguishable */}
      <div className="border-b border-border bg-gradient-to-b from-card to-card px-4 py-4 text-center">
        <h3 className="text-base font-black uppercase tracking-widest text-foreground">
          {day.dayName}
          {day.isTrainingDay && (
            <span className="ml-2 text-xs" title="Training Day">
              &#x1F4AA;
            </span>
          )}
        </h3>
        <p className="mt-1 font-mono text-xs font-semibold text-muted-foreground">
          {day.targetKcal} kcal target
        </p>
      </div>

      {/* Day macro summary - visually distinct from cards */}
      <div className="border-b border-border bg-background px-4 py-3 shadow-inner">
        <div className="text-center">
          <span className="text-lg font-black text-primary">{dayTotalKcal}</span>
          <span className="ml-1 text-xs font-semibold text-muted-foreground">kcal</span>
        </div>
        <div className="mt-1.5 flex justify-center gap-3 text-xs font-semibold">
          <span className="text-chart-3">P {dayTotalProtein}g</span>
          <span className="text-warning">C {dayTotalCarbs}g</span>
          <span className="text-destructive">F {dayTotalFat}g</span>
        </div>
      </div>

      {/* Meals */}
      <div className="flex-1 space-y-2.5 p-2.5" data-testid={`day-${day.dayNumber}-meals`}>
        {day.meals.map((meal, mealIdx) => {
          const isSwapping =
            swappingMeal?.dayNumber === day.dayNumber && swappingMeal?.mealIdx === mealIdx;

          if (isSwapping) {
            return <MealCardSkeleton key={mealIdx} />;
          }

          const isSwapSuccess =
            swapSuccess?.dayNumber === day.dayNumber && swapSuccess?.mealIdx === mealIdx;

          return (
            <div
              key={mealIdx}
              className={`group relative rounded-lg border border-border card-elevation p-3 transition-all outline-none ${
                isSwapSuccess
                  ? 'border-green-500/60 bg-green-500/5 ring-1 ring-green-500/30'
                  : 'hover:border-border/80'
              } focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary`}
              onClick={() => onMealClick(day.dayNumber, mealIdx, meal)}
              onKeyDown={(e) => handleMealKeyDown(e, day.dayNumber, mealIdx, meal)}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${meal.name}`}
              data-testid={`meal-card-${day.dayNumber}-${mealIdx}`}
            >
              {/* Swap success indicator + undo button */}
              {isSwapSuccess && (
                <div className="absolute -top-2 -right-1 z-10 flex items-center gap-1">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30"
                    data-testid={`swap-success-${day.dayNumber}-${mealIdx}`}
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndoClick(day.dayNumber, mealIdx, meal.slot);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors"
                    data-testid={`undo-button-${day.dayNumber}-${mealIdx}`}
                    aria-label={`Undo swap of ${meal.name}`}
                    title="Undo swap"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {/* Swap icon button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!swapInProgress) onSwapClick(day.dayNumber, mealIdx, meal);
                }}
                disabled={swapInProgress}
                className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-all ${
                  swapInProgress
                    ? 'opacity-30 cursor-not-allowed'
                    : 'opacity-0 group-hover:opacity-100 hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
                }`}
                data-testid={`swap-icon-${day.dayNumber}-${mealIdx}`}
                aria-label={`Swap ${meal.name}`}
                title={swapInProgress ? 'Swap in progress...' : 'Swap this meal'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 16L3 12M3 12L7 8M3 12H16M17 8L21 12M21 12L17 16M21 12H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Slot label + Confidence badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-primary/20 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-primary border border-primary/30">
                  {meal.slot}
                </span>
                <span
                  data-testid={`confidence-badge-${day.dayNumber}-${mealIdx}`}
                  className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider border ${
                    meal.confidenceLevel === 'verified'
                      ? 'bg-success/20 text-success border-success/30'
                      : 'bg-warning/20 text-warning border-warning/30'
                  }`}
                >
                  {meal.confidenceLevel === 'verified' ? '✓ Verified' : '⚡ AI-Estimated'}
                </span>
              </div>

              {/* Meal name - primary visual element in card */}
              <h4
                className="text-sm font-bold text-foreground leading-snug pr-7 line-clamp-2"
                data-testid={`meal-name-${day.dayNumber}-${mealIdx}`}
                title={meal.name}
              >
                {meal.name}
              </h4>

              {meal.cuisine && (
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">{meal.cuisine}</p>
              )}

              {/* Prep time indicator */}
              <div
                className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
                data-testid={`prep-time-${day.dayNumber}-${mealIdx}`}
              >
                <span className="text-[12px]">🕒</span>
                <span className="font-medium">
                  {meal.prepTimeMin ? `${meal.prepTimeMin}m prep` : ''}
                  {meal.prepTimeMin && meal.cookTimeMin ? ' + ' : ''}
                  {meal.cookTimeMin ? `${meal.cookTimeMin}m cook` : ''}
                  {!meal.prepTimeMin && !meal.cookTimeMin ? 'Time N/A' : ''}
                </span>
              </div>

              {/* Macro pills */}
              <div
                className="mt-2.5 flex flex-wrap gap-1.5"
                data-testid={`macro-pills-${day.dayNumber}-${mealIdx}`}
              >
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-1 text-[11px] font-bold text-primary border border-primary/20">
                  {meal.nutrition.kcal} kcal
                </span>
                <span className="inline-flex items-center rounded-full bg-chart-3/15 px-2 py-1 text-[11px] font-bold text-chart-3 border border-chart-3/20">
                  P {meal.nutrition.proteinG}g
                </span>
                <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-1 text-[11px] font-bold text-warning border border-warning/20">
                  C {meal.nutrition.carbsG}g
                </span>
                <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-1 text-[11px] font-bold text-destructive border border-destructive/20">
                  F {meal.nutrition.fatG}g
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
