"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import NavBar from '@/components/navigation/NavBar';
import MealDetailModal from '@/components/meal-plan/MealDetailModal';

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

interface PlanDay {
  dayNumber: number;
  dayName: string;
  isTrainingDay: boolean;
  targetKcal: number;
  meals: Meal[];
}

interface GroceryItem {
  name: string;
  amount: number;
  unit: string;
}

interface GroceryCategory {
  category: string;
  items: GroceryItem[];
}

/**
 * Normalize a raw grocery item (from various pipeline formats) into standard GroceryItem.
 * Handles cases where items may be strings, have 'amount' as string (e.g., "700g"), or be
 * in the proper {name, amount, unit} format.
 */
function normalizeGroceryItem(raw: Record<string, unknown>): GroceryItem {
  const name = (raw.name as string) || (raw.food_name as string) || (raw.item as string) || 'Unknown Item';
  let amount: number;
  let unit: string;

  if (typeof raw.amount === 'number' && typeof raw.unit === 'string') {
    // Standard format: { name, amount: number, unit: string }
    amount = raw.amount;
    unit = raw.unit;
  } else if (typeof raw.amount === 'string') {
    // Legacy format: { name, amount: "700g" } — parse number and unit from string
    const match = (raw.amount as string).match(/^([\d.]+)\s*(.*)$/);
    if (match) {
      amount = parseFloat(match[1]);
      unit = match[2] || (raw.unit as string) || '';
    } else {
      amount = 0;
      unit = raw.amount as string;
    }
  } else if (typeof raw.quantity === 'number') {
    // Alternative format: { name, quantity, unit }
    amount = raw.quantity as number;
    unit = (raw.unit as string) || '';
  } else {
    amount = 0;
    unit = '';
  }

  return { name, amount, unit };
}

/**
 * Normalize a raw grocery list from any pipeline format into standard GroceryCategory[].
 * Handles multiple formats:
 * 1. Standard: { category, items: [{ name, amount, unit }] }
 * 2. String items: { category, items: ["Chicken breast", "Rice"] }
 * 3. Legacy amounts: { category, items: [{ name, amount: "700g" }] }
 */
function normalizeGroceryList(raw: unknown[]): GroceryCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .filter((cat): cat is Record<string, unknown> => cat !== null && typeof cat === 'object')
    .map((cat) => {
      const items = Array.isArray(cat.items)
        ? (cat.items as unknown[]).map((item) => {
            // Case 1: item is a string (e.g., "Chicken breast")
            if (typeof item === 'string') {
              return { name: item, amount: 0, unit: '' };
            }
            // Case 2: item is an object
            if (item !== null && typeof item === 'object') {
              return normalizeGroceryItem(item as Record<string, unknown>);
            }
            return { name: String(item), amount: 0, unit: '' };
          })
        : [];
      return {
        category: (cat.category as string) || 'Other',
        items,
      };
    })
    .filter((cat) => cat.items.length > 0);
}

interface PlanData {
  id: string;
  dailyKcalTarget: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;
  trainingBonusKcal: number | null;
  planDays: number;
  startDate: string;
  endDate: string;
  qaScore: number | null;
  qaStatus: string | null;
  status: string;
  generatedAt: string;
  pdfUrl?: string | null;
  validatedPlan: {
    days: PlanDay[];
    groceryList?: unknown[];
    qa?: { status: string; score: number; iterations?: number };
    weeklyTotals?: {
      avgKcal: number;
      avgProteinG: number;
      avgCarbsG: number;
      avgFatG: number;
    };
  };
  metabolicProfile: {
    bmrKcal?: number;
    tdeeKcal?: number;
    goalKcal?: number;
    proteinTargetG?: number;
    carbsTargetG?: number;
    fatTargetG?: number;
  };
  profile?: {
    name: string;
    sex: string;
    age: number;
    goalType: string;
    activityLevel: string;
  };
}

interface SwapTarget {
  dayNumber: number;
  mealIdx: number;
  meal: Meal;
}

/** Skeleton loader that replaces a meal card during swap */
function MealCardSkeleton() {
  return (
    <div
      className="rounded-lg border border-[#2a2a2a] card-elevation p-3"
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

/** Swap alternatives modal */
function SwapModal({
  target,
  alternatives,
  loading,
  onSelect,
  onClose,
}: {
  target: SwapTarget;
  alternatives: Meal[];
  loading: boolean;
  onSelect: (alt: Meal) => void;
  onClose: () => void;
}) {
  const [selecting, setSelecting] = useState(false);

  const handleSelect = (alt: Meal) => {
    if (selecting) return;
    setSelecting(true);
    onSelect(alt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="swap-modal">
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-[#2a2a2a] card-elevation-modal">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa]">
              Swap Meal
            </h3>
            <p className="mt-0.5 text-xs text-[#a1a1aa]">
              Replace <span className="text-[#f97316] font-semibold">{target.meal.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#a1a1aa] transition-colors hover:bg-[#2a2a2a] hover:text-[#fafafa]"
            data-testid="swap-modal-close"
            aria-label="Close swap modal"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3" data-testid="swap-alternatives-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-[#2a2a2a] card-elevation p-4">
                  <div className="h-4 w-2/3 rounded skeleton-shimmer" />
                  <div className="mt-2 h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="mt-2 flex gap-2">
                    <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                    <div className="h-5 w-12 rounded-full skeleton-shimmer" />
                    <div className="h-5 w-12 rounded-full skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : alternatives.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#a1a1aa]">No alternatives available for this meal slot.</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="swap-alternatives-list">
              {alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(alt)}
                  disabled={selecting}
                  className={`w-full rounded-lg border border-[#2a2a2a] card-elevation p-4 text-left transition-all ${
                    selecting
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-[#f97316]/50"
                  }`}
                  data-testid={`swap-alternative-${idx}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[#fafafa] truncate" title={alt.name}>
                        {alt.name}
                      </h4>
                      {alt.cuisine && (
                        <p className="mt-0.5 text-xs text-[#71717a]">{alt.cuisine}</p>
                      )}
                      <div className="mt-1 text-[10px] text-[#71717a]">
                        {alt.prepTimeMin ? `${alt.prepTimeMin}m prep` : ""}
                        {alt.prepTimeMin && alt.cookTimeMin ? " + " : ""}
                        {alt.cookTimeMin ? `${alt.cookTimeMin}m cook` : ""}
                      </div>
                    </div>
                    <span className="ml-2 rounded bg-[#f97316]/20 px-2 py-1 text-[10px] font-bold text-[#f97316]">
                      SELECT
                    </span>
                  </div>
                  {/* Macro pills */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-[#f97316]/15 px-2 py-0.5 text-[10px] font-bold text-[#f97316]">
                      {alt.nutrition.kcal} kcal
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#3b82f6]/15 px-2 py-0.5 text-[10px] font-bold text-[#3b82f6]">
                      P {alt.nutrition.proteinG}g
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                      C {alt.nutrition.carbsG}g
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#ef4444]">
                      F {alt.nutrition.fatG}g
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  swappingMeal,
  swapSuccess,
  swapInProgress,
  onSwapClick,
  onMealClick,
  onUndoClick,
}: {
  day: PlanDay;
  swappingMeal: { dayNumber: number; mealIdx: number } | null;
  swapSuccess: { dayNumber: number; mealIdx: number } | null;
  swapInProgress: boolean;
  onSwapClick: (dayNumber: number, mealIdx: number, meal: Meal) => void;
  onMealClick: (dayNumber: number, mealIdx: number, meal: Meal) => void;
  onUndoClick: (dayNumber: number, mealIdx: number, slot: string) => void;
}) {
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
    <div className="flex flex-col rounded-lg border border-[#2a2a2a] card-elevation overflow-hidden" data-testid={`day-column-${day.dayNumber}`}>
      {/* Day header - prominent and distinguishable */}
      <div className="border-b border-[#2a2a2a] bg-gradient-to-b from-[#1a1a1a] to-[#141414] px-4 py-4 text-center">
        <h3 className="text-base font-black uppercase tracking-widest text-[#fafafa]">
          {day.dayName}
          {day.isTrainingDay && (
            <span className="ml-2 text-xs" title="Training Day">&#x1F4AA;</span>
          )}
        </h3>
        <p className="mt-1 font-mono text-xs font-semibold text-[#a1a1aa]">
          {day.targetKcal} kcal target
        </p>
      </div>

      {/* Day macro summary - visually distinct from cards */}
      <div className="border-b border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 shadow-inner">
        <div className="text-center">
          <span className="text-lg font-black text-[#f97316]">{dayTotalKcal}</span>
          <span className="ml-1 text-xs font-semibold text-[#a1a1aa]">kcal</span>
        </div>
        <div className="mt-1.5 flex justify-center gap-3 text-xs font-semibold">
          <span className="text-[#3b82f6]">P {dayTotalProtein}g</span>
          <span className="text-[#f59e0b]">C {dayTotalCarbs}g</span>
          <span className="text-[#ef4444]">F {dayTotalFat}g</span>
        </div>
      </div>

      {/* Meals */}
      <div className="flex-1 space-y-2.5 p-2.5" data-testid={`day-${day.dayNumber}-meals`}>
        {day.meals.map((meal, mealIdx) => {
          const isSwapping =
            swappingMeal?.dayNumber === day.dayNumber &&
            swappingMeal?.mealIdx === mealIdx;

          if (isSwapping) {
            return <MealCardSkeleton key={mealIdx} />;
          }

          const isSwapSuccess =
            swapSuccess?.dayNumber === day.dayNumber &&
            swapSuccess?.mealIdx === mealIdx;

          return (
            <div
              key={mealIdx}
              className={`group relative rounded-lg border border-[#2a2a2a] card-elevation p-3 transition-all outline-none ${
                isSwapSuccess
                  ? "border-green-500/60 bg-green-500/5 ring-1 ring-green-500/30"
                  : "hover:border-[#3a3a3a]"
              } focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:border-[#f97316]`}
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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30" data-testid={`swap-success-${day.dayNumber}-${mealIdx}`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
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
                className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-transparent bg-transparent text-[#a1a1aa] transition-all ${
                  swapInProgress
                    ? "opacity-30 cursor-not-allowed"
                    : "opacity-0 group-hover:opacity-100 hover:border-[#f97316]/50 hover:bg-[#f97316]/10 hover:text-[#f97316]"
                }`}
                data-testid={`swap-icon-${day.dayNumber}-${mealIdx}`}
                aria-label={`Swap ${meal.name}`}
                title={swapInProgress ? "Swap in progress..." : "Swap this meal"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 16L3 12M3 12L7 8M3 12H16M17 8L21 12M21 12L17 16M21 12H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Slot label + Confidence badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-[#f97316]/20 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-[#f97316] border border-[#f97316]/30">
                  {meal.slot}
                </span>
                <span
                  data-testid={`confidence-badge-${day.dayNumber}-${mealIdx}`}
                  className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider border ${
                    meal.confidenceLevel === "verified"
                      ? "bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30"
                      : "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30"
                  }`}
                >
                  {meal.confidenceLevel === "verified" ? "✓ Verified" : "⚡ AI-Estimated"}
                </span>
              </div>

              {/* Meal name - primary visual element in card */}
              <h4
                className="text-sm font-bold text-[#fafafa] leading-snug pr-7 line-clamp-2"
                data-testid={`meal-name-${day.dayNumber}-${mealIdx}`}
                title={meal.name}
              >
                {meal.name}
              </h4>

              {meal.cuisine && (
                <p className="mt-1 text-[11px] font-medium text-[#a1a1aa]">{meal.cuisine}</p>
              )}

              {/* Prep time indicator */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#a1a1aa]" data-testid={`prep-time-${day.dayNumber}-${mealIdx}`}>
                <span className="text-[12px]">🕒</span>
                <span className="font-medium">
                  {meal.prepTimeMin ? `${meal.prepTimeMin}m prep` : ""}
                  {meal.prepTimeMin && meal.cookTimeMin ? " + " : ""}
                  {meal.cookTimeMin ? `${meal.cookTimeMin}m cook` : ""}
                  {!meal.prepTimeMin && !meal.cookTimeMin ? "Time N/A" : ""}
                </span>
              </div>

              {/* Macro pills */}
              <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid={`macro-pills-${day.dayNumber}-${mealIdx}`}>
                <span className="inline-flex items-center rounded-full bg-[#f97316]/15 px-2 py-1 text-[11px] font-bold text-[#f97316] border border-[#f97316]/20">
                  {meal.nutrition.kcal} kcal
                </span>
                <span className="inline-flex items-center rounded-full bg-[#3b82f6]/15 px-2 py-1 text-[11px] font-bold text-[#3b82f6] border border-[#3b82f6]/20">
                  P {meal.nutrition.proteinG}g
                </span>
                <span className="inline-flex items-center rounded-full bg-[#f59e0b]/15 px-2 py-1 text-[11px] font-bold text-[#f59e0b] border border-[#f59e0b]/20">
                  C {meal.nutrition.carbsG}g
                </span>
                <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-2 py-1 text-[11px] font-bold text-[#ef4444] border border-[#ef4444]/20">
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

/**
 * Format a grocery amount for practical display.
 * Rounds UP to the nearest practical amount (e.g., "2 lbs" not "1.73 lbs").
 * This ensures shoppers buy enough rather than too little.
 */
function formatGroceryAmount(amount: number, unit: string): string {
  if (!amount && !unit) return 'as needed';
  if (!amount || isNaN(amount)) return unit || 'as needed';

  const unitStr = unit || '';

  // For display, format whole numbers without decimals
  if (Number.isInteger(amount)) {
    return `${amount} ${unitStr}`.trim();
  }

  // For quarter increments, show as fraction-like
  const quarters = amount * 4;
  if (Number.isInteger(Math.round(quarters))) {
    const frac = amount % 1;
    const whole = Math.floor(amount);
    if (Math.abs(frac - 0.25) < 0.01) return `${whole > 0 ? whole + ' ' : ''}1/4 ${unitStr}`.trim();
    if (Math.abs(frac - 0.5) < 0.01) return `${whole > 0 ? whole + ' ' : ''}1/2 ${unitStr}`.trim();
    if (Math.abs(frac - 0.75) < 0.01) return `${whole > 0 ? whole + ' ' : ''}3/4 ${unitStr}`.trim();
  }

  // Round UP to nearest whole number for practical shopping
  // e.g., 1.73 lbs → 2 lbs, 0.52 lbs → 1 lb
  const roundedUp = Math.ceil(amount);
  return `${roundedUp} ${unitStr}`.trim();
}

/** Category icon mapping for grocery list */
function getCategoryIcon(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('meat') || lower.includes('seafood')) return '🥩';
  if (lower.includes('dairy') || lower.includes('egg')) return '🥛';
  if (lower.includes('produce') || lower.includes('vegetable')) return '🥦';
  if (lower.includes('fruit')) return '🍎';
  if (lower.includes('grain') || lower.includes('bread')) return '🌾';
  if (lower.includes('legume') || lower.includes('plant protein')) return '🫘';
  if (lower.includes('oil') || lower.includes('condiment')) return '🫒';
  if (lower.includes('spice') || lower.includes('season')) return '🧂';
  if (lower.includes('nut') || lower.includes('seed')) return '🥜';
  return '🛒';
}

function GroceryListSection({ groceryList }: { groceryList: GroceryCategory[] }) {
  const [expanded, setExpanded] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const totalItems = groceryList.reduce((sum, cat) => sum + cat.items.length, 0);

  // Format grocery list as plain text for export
  const formatGroceryListText = useCallback(() => {
    const lines: string[] = [];
    lines.push('ZERO SUM NUTRITION - GROCERY LIST');
    lines.push('================================');
    lines.push('');

    for (const cat of groceryList) {
      lines.push(`${cat.category} (${cat.items.length} items)`);
      lines.push('-'.repeat(Math.min(cat.category.length + 15, 40)));
      for (const item of cat.items) {
        const amount = formatGroceryAmount(item.amount, item.unit);
        lines.push(`  • ${item.name} - ${amount}`);
      }
      lines.push('');
    }

    lines.push('================================');
    lines.push(`Total: ${totalItems} items across ${groceryList.length} categories`);

    return lines.join('\n');
  }, [groceryList, totalItems]);

  // Copy grocery list to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      const text = formatGroceryListText();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [formatGroceryListText]);

  // Download grocery list as text file
  const handleDownloadText = useCallback(() => {
    const text = formatGroceryListText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formatGroceryListText]);

  return (
    <div className="mx-auto max-w-[1600px] pb-8" data-testid="grocery-list-section">
      {/* Section header */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#141414]">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 flex-1"
            data-testid="grocery-list-toggle"
          >
            <span className="text-xl">🛒</span>
            <div className="text-left">
              <h2 className="text-lg font-bold uppercase tracking-wider text-[#fafafa]">
                Grocery List
              </h2>
              <p className="text-xs text-[#a1a1aa]">
                {totalItems} items across {groceryList.length} categories
              </p>
            </div>
          </button>

          {/* Export buttons - shown on right side */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#2a2a2a] hover:text-[#fafafa]"
              data-testid="grocery-copy-button"
              aria-label="Copy grocery list to clipboard"
              title="Copy to clipboard"
            >
              {copySuccess ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#2a2a2a] hover:text-[#fafafa]"
              data-testid="grocery-download-button"
              aria-label="Download grocery list as text file"
              title="Download as text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-2 flex-shrink-0"
              data-testid="grocery-list-expand-toggle"
              aria-label={expanded ? 'Collapse grocery list' : 'Expand grocery list'}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className={`text-[#a1a1aa] transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Category grid */}
      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grocery-list-categories">
          {groceryList.map((cat) => (
            <div
              key={cat.category}
              className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden"
              data-testid={`grocery-category-${cat.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              {/* Category header */}
              <div className="border-b border-[#2a2a2a] bg-[#141414] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getCategoryIcon(cat.category)}</span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa]">
                    {cat.category}
                  </h3>
                  <span className="ml-auto rounded-full bg-[#f97316]/15 px-2 py-0.5 text-[10px] font-bold text-[#f97316]">
                    {cat.items.length}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-[#2a2a2a]">
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[#222]"
                    data-testid={`grocery-item-${(item.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    <span className="text-sm text-[#fafafa] break-words" title={item.name || 'Unknown Item'}>
                      {item.name || 'Unknown Item'}
                    </span>
                    <span className="ml-3 flex-shrink-0 whitespace-nowrap rounded bg-[#2a2a2a] px-2 py-0.5 font-mono text-xs font-bold text-[#a1a1aa]" data-testid={`grocery-amount-${(item.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      {formatGroceryAmount(item.amount, item.unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MealPlanPage() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Swap state
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<Meal[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swappingMeal, setSwappingMeal] = useState<{ dayNumber: number; mealIdx: number } | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<{ dayNumber: number; mealIdx: number } | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  // Ref-based guard for synchronous double-click prevention (state updates are async)
  const swapLockRef = useRef(false);

  // Meal detail modal state
  const [selectedMeal, setSelectedMeal] = useState<{ meal: Meal; dayNumber: number; mealIdx: number } | null>(null);

  // Plan replacement state
  const [planReplaced, setPlanReplaced] = useState(false);
  const [newerPlanId, setNewerPlanId] = useState<string | null>(null);
  const planStatusCheckRef = useRef<AbortController | null>(null);

  // Track the current fetch request so we can abort stale ones
  const planAbortRef = useRef<AbortController | null>(null);
  const planFetchGenRef = useRef(0);

  // Tab view state
  const [activeTab, setActiveTab] = useState<'meal-plan' | 'grocery-list'>('meal-plan');

  const fetchPlan = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (planAbortRef.current) {
      planAbortRef.current.abort();
    }
    const controller = new AbortController();
    planAbortRef.current = controller;
    const generation = ++planFetchGenRef.current;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/active", { signal: controller.signal });
      // If a newer fetch was started, discard this stale response
      if (generation !== planFetchGenRef.current) return;
      const data = await res.json();
      if (generation !== planFetchGenRef.current) return;

      if (res.ok && data.hasActivePlan) {
        setPlan(data.plan);
      } else {
        setError(data.error || "No active meal plan found");
      }
    } catch (err) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (generation !== planFetchGenRef.current) return;
      console.error("Error fetching meal plan:", err);
      setError("Failed to load meal plan. Please check your connection and try again.");
    } finally {
      if (generation === planFetchGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Check if the current plan has been replaced (called when window regains focus)
  const checkPlanStatus = useCallback(async () => {
    if (!plan?.id) return;

    // Abort any in-flight status check
    if (planStatusCheckRef.current) {
      planStatusCheckRef.current.abort();
    }

    const controller = new AbortController();
    planStatusCheckRef.current = controller;

    try {
      const res = await fetch(`/api/plan/${plan.id}/status`, {
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isReplaced || data.hasNewerPlan) {
          setPlanReplaced(true);
          setNewerPlanId(data.newerPlanId);
        }
      }
    } catch (err) {
      // Ignore aborted requests and errors - this is a non-critical check
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.debug('Error checking plan status (non-critical):', err);
    }
  }, [plan?.id]);

  useEffect(() => {
    fetchPlan();
    // Cleanup: abort any in-flight request when component unmounts
    return () => {
      if (planAbortRef.current) {
        planAbortRef.current.abort();
      }
      if (planStatusCheckRef.current) {
        planStatusCheckRef.current.abort();
      }
    };
  }, [fetchPlan]);

  // Check plan status when window regains focus (user switched back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && plan && !planReplaced) {
        checkPlanStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [plan, planReplaced, checkPlanStatus]);

  // Handle swap icon click - open modal and fetch alternatives
  const handleSwapClick = useCallback(
    async (dayNumber: number, mealIdx: number, meal: Meal) => {
      // Prevent interactions on replaced plans
      if (planReplaced) {
        // Check plan status again and show banner if still replaced
        await checkPlanStatus();
        if (planReplaced) {
          return;
        }
      }

      // Synchronous ref-based guard prevents double-click (state updates are async)
      if (swapLockRef.current) return;
      swapLockRef.current = true;

      setSwapTarget({ dayNumber, mealIdx, meal });
      setSwapLoading(true);
      setSwapAlternatives([]);

      try {
        const res = await fetch("/api/plan/swap/alternatives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan?.id,
            dayNumber,
            slot: meal.slot,
            currentMealName: meal.name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSwapAlternatives(data.alternatives || []);
        } else if (res.status === 400) {
          // Plan might be replaced or inactive
          const data = await res.json();
          if (data.error?.includes('not active') || data.error?.includes('replaced')) {
            await checkPlanStatus();
          }
        }
      } catch (err) {
        console.error("Failed to fetch swap alternatives:", err);
      } finally {
        setSwapLoading(false);
        swapLockRef.current = false;
      }
    },
    [plan?.id, planReplaced, checkPlanStatus]
  );

  // Handle selecting a swap alternative with retry logic
  const handleSwapSelect = useCallback(
    async (alt: Meal) => {
      if (!swapTarget || !plan) return;

      // Close modal and show skeleton
      const target = swapTarget;
      setSwapTarget(null);
      setSwapError(null); // Clear any previous error
      setSwappingMeal({ dayNumber: target.dayNumber, mealIdx: target.mealIdx });

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000; // 1 second between retries
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await fetch("/api/plan/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId: plan.id,
              dayNumber: target.dayNumber,
              slot: target.meal.slot,
              mealIdx: target.mealIdx,
              originalMeal: target.meal,
              newMeal: alt,
            }),
          });

          if (res.ok) {
            const data = await res.json();

            // Update the plan locally
            const updatedDays = [...(plan.validatedPlan?.days || [])];
            const dayIdx = updatedDays.findIndex(
              (d) => d.dayNumber === target.dayNumber
            );
            if (dayIdx !== -1 && updatedDays[dayIdx].meals[target.mealIdx]) {
              updatedDays[dayIdx].meals[target.mealIdx] = alt;
              setPlan({
                ...plan,
                validatedPlan: {
                  ...plan.validatedPlan,
                  days: updatedDays,
                },
              });
            }

            // Success - clear error and show success indicator
            setSwapError(null);
            setTimeout(() => {
              setSwappingMeal(null);
              swapLockRef.current = false;
              setSwapSuccess({ dayNumber: target.dayNumber, mealIdx: target.mealIdx });
              // Clear success indicator after 3 seconds
              setTimeout(() => {
                setSwapSuccess(null);
              }, 3000);
            }, 500);
            return; // Exit on success
          } else {
            // Non-OK response - store error for potential retry
            const errorData = await res.json().catch(() => ({ error: res.statusText }));
            lastError = new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);

            // If this is the last attempt, we'll handle it after the loop
            if (attempt < MAX_RETRIES - 1) {
              console.log(`Swap attempt ${attempt + 1} failed, retrying... (${lastError.message})`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
          }
        } catch (err) {
          lastError = err as Error;

          // Network error or other exception - retry if attempts remain
          if (attempt < MAX_RETRIES - 1) {
            console.log(`Swap attempt ${attempt + 1} failed with error, retrying... (${lastError.message})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      // If we get here, all retries failed
      console.error(`Failed to swap meal after ${MAX_RETRIES} attempts:`, lastError);
      setSwapError(`Failed to swap meal after ${MAX_RETRIES} attempts. Please try again.`);

      // Clear skeleton state and lock
      setTimeout(() => {
        setSwappingMeal(null);
        swapLockRef.current = false;
        // Clear error after 5 seconds
        setTimeout(() => {
          setSwapError(null);
        }, 5000);
      }, 500);
    },
    [swapTarget, plan]
  );

  const handleSwapClose = useCallback(() => {
    setSwapTarget(null);
    setSwapAlternatives([]);
    setSwapLoading(false);
    swapLockRef.current = false;
  }, []);

  // Handle undo swap
  const handleUndoClick = useCallback(
    async (dayNumber: number, mealIdx: number, slot: string) => {
      if (!plan || swapLockRef.current) return;

      swapLockRef.current = true;

      try {
        const res = await fetch("/api/plan/swap/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            dayNumber,
            slot,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          // Update the plan locally with the restored meal
          const updatedDays = [...(plan.validatedPlan?.days || [])];
          const dayIdx = updatedDays.findIndex((d) => d.dayNumber === dayNumber);
          if (dayIdx !== -1 && updatedDays[dayIdx].meals[mealIdx]) {
            updatedDays[dayIdx].meals[mealIdx] = data.restoredMeal;
            setPlan({
              ...plan,
              validatedPlan: {
                ...plan.validatedPlan,
                days: updatedDays,
              },
            });
          }

          // Clear the swap success indicator
          setSwapSuccess(null);
        }
      } catch (err) {
        console.error("Failed to undo swap:", err);
      } finally {
        swapLockRef.current = false;
      }
    },
    [plan]
  );

  // Handle dismissing the plan replaced banner
  const handleDismissReplacedBanner = useCallback(() => {
    setPlanReplaced(false);
  }, []);

  // Handle viewing the newer plan
  const handleViewNewerPlan = useCallback(() => {
    // Reload the page which will fetch the active plan
    window.location.reload();
  }, []);

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
            {/* Skeleton Header */}
            <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-6">
              <div className="mx-auto max-w-[1600px]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-3 w-40 rounded skeleton-shimmer" />
                    <div className="mt-2 h-7 w-56 rounded skeleton-shimmer" />
                    <div className="mt-2 h-4 w-48 rounded skeleton-shimmer" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-20 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] skeleton-shimmer" />
                    <div className="h-14 w-20 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] skeleton-shimmer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Skeleton 7-day grid - Responsive layout matching main grid */}
            <div className="mx-auto max-w-[1600px] px-4 py-6">
              <div
                className="
                  flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory
                  md:grid md:grid-cols-3 md:overflow-x-visible md:pb-0
                  lg:grid-cols-4
                  xl:grid-cols-5
                  2xl:grid-cols-7
                "
                data-testid="meal-plan-skeleton-grid"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => (
                  <div key={dayNum} className="min-w-[280px] snap-start md:min-w-0">
                    <div className="flex flex-col rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden" data-testid={`skeleton-day-${dayNum}`}>
                      {/* Skeleton day header */}
                      <div className="border-b border-[#2a2a2a] bg-gradient-to-b from-[#1a1a1a] to-[#141414] px-4 py-4 text-center">
                        <div className="mx-auto h-5 w-24 rounded skeleton-shimmer" />
                        <div className="mx-auto mt-2 h-3.5 w-28 rounded skeleton-shimmer" />
                      </div>

                      {/* Skeleton day macro summary */}
                      <div className="border-b border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 shadow-inner">
                        <div className="mx-auto h-5 w-20 rounded skeleton-shimmer" />
                        <div className="mt-1.5 flex justify-center gap-3">
                          <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                          <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                          <div className="h-3.5 w-12 rounded skeleton-shimmer" />
                        </div>
                      </div>

                      {/* Skeleton meal cards */}
                      <div className="flex-1 space-y-2.5 p-2.5">
                        {[1, 2, 3, 4].map((mealNum) => (
                          <div
                            key={mealNum}
                            className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3"
                            data-testid={`skeleton-meal-card-${dayNum}-${mealNum}`}
                          >
                            {/* Slot label + confidence badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-4.5 w-16 rounded-md skeleton-shimmer" />
                              <div className="h-3.5 w-14 rounded-md skeleton-shimmer" />
                            </div>
                            {/* Meal name */}
                            <div className="h-4 w-3/4 rounded skeleton-shimmer mt-1" />
                            {/* Prep time */}
                            <div className="h-3 w-1/2 rounded skeleton-shimmer mt-2" />
                            {/* Macro pills */}
                            <div className="mt-2.5 flex gap-1.5">
                              <div className="h-5 w-14 rounded-full skeleton-shimmer" />
                              <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                              <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                              <div className="h-5 w-10 rounded-full skeleton-shimmer" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !plan) {
    const isNetworkError = error?.toLowerCase().includes('failed to load') || error?.toLowerCase().includes('network') || error?.toLowerCase().includes('fetch');
    return (
      <>
        <NavBar />
        <div className="md:pt-14 pb-20 md:pb-0">
          <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
            <div className="w-full max-w-md text-center" data-testid="meal-plan-empty-state">
              <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f97316]/10">
                  <span className="text-2xl">{isNetworkError ? '⚠️' : '📋'}</span>
                </div>
                <h2 className="text-xl font-bold text-[#fafafa]" data-testid="empty-state-message">
                  {isNetworkError ? 'Connection Error' : 'No Active Plan'}
                </h2>
                <p className="mt-2 text-sm text-[#a1a1aa]" data-testid="empty-state-description">
                  {error || "You haven't generated a meal plan yet."}
                </p>
                <div className="mt-6 flex flex-col gap-3 items-center">
                  {isNetworkError && (
                    <button
                      onClick={fetchPlan}
                      data-testid="retry-button"
                      className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
                    >
                      Retry
                    </button>
                  )}
                  <a
                    href="/generate"
                    className={`inline-block rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                      isNetworkError
                        ? 'border border-[#2a2a2a] text-[#a1a1aa] hover:bg-[#252525]'
                        : 'bg-[#f97316] text-[#0a0a0a] hover:bg-[#ea580c]'
                    }`}
                    data-testid="generate-plan-cta"
                  >
                    Generate Plan
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const days = plan.validatedPlan?.days || [];

  return (
    <>
    <NavBar />
    {planReplaced && (
      <div
        className="fixed top-14 left-0 right-0 z-40 border-b border-[#f97316]/50 bg-[#1a1a1a] px-4 py-3 md:top-14"
        role="alert"
        aria-live="polite"
        data-testid="plan-replaced-banner"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20">
                <svg className="h-4 w-4 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#fafafa]" data-testid="plan-replaced-title">
                  Plan Updated
                </p>
                <p className="text-xs text-[#a1a1aa]" data-testid="plan-replaced-description">
                  A newer meal plan has been generated. You're viewing an outdated plan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleViewNewerPlan}
                className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
                data-testid="view-newer-plan-button"
              >
                View New Plan
              </button>
              <button
                onClick={handleDismissReplacedBanner}
                className="rounded-lg border border-[#2a2a2a] px-3 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#252525] hover:text-[#fafafa]"
                data-testid="dismiss-replaced-banner"
                aria-label="Dismiss notification"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    <div className={`md:pt-14 pb-20 md:pb-0 ${planReplaced ? 'md:mt-12' : ''}`}>
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
                /// ZERO SUM NUTRITION
              </p>
              <h1 className="mt-1 text-2xl font-heading uppercase tracking-wider text-[#fafafa]">
                Your Meal Plan
              </h1>
              {plan.profile && (
                <p className="mt-1 text-sm text-[#a1a1aa]">
                  {plan.profile.name} &middot; {plan.profile.goalType} &middot; {plan.planDays}-day plan
                </p>
              )}
              {plan.generatedAt && (
                <p className="mt-1 text-xs text-[#a1a1aa]" data-testid="plan-generated-date">
                  Generated {new Date(plan.generatedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {plan.qaStatus && (
                <div
                  className="rounded-lg border px-3 py-2 text-center"
                  style={{
                    backgroundColor: plan.qaStatus === 'PASS' ? 'rgba(34, 197, 94, 0.1)' :
                                   plan.qaStatus === 'WARN' ? 'rgba(245, 158, 11, 0.1)' :
                                   'rgba(239, 68, 68, 0.1)',
                    borderColor: plan.qaStatus === 'PASS' ? 'rgba(34, 197, 94, 0.3)' :
                                plan.qaStatus === 'WARN' ? 'rgba(245, 158, 11, 0.3)' :
                                'rgba(239, 68, 68, 0.3)'
                  }}
                  title={`QA Status: ${plan.qaStatus}${plan.qaScore !== null ? ` (${plan.qaScore}%)` : ''}`}
                  data-testid="qa-score-badge"
                >
                  <p className="font-mono text-xs text-[#a1a1aa]">QA Score</p>
                  <p
                    className="text-lg font-bold"
                    style={{
                      color: plan.qaStatus === 'PASS' ? '#22c55e' :
                             plan.qaStatus === 'WARN' ? '#f59e0b' :
                             '#ef4444'
                    }}
                  >
                    {plan.qaScore !== null ? `${plan.qaScore}%` : 'N/A'}
                  </p>
                </div>
              )}
              {plan.dailyKcalTarget && (
                <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2">
                  <p className="font-mono text-xs text-[#a1a1aa] text-center mb-1">Daily Targets</p>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#f97316]">{plan.dailyKcalTarget}</p>
                      <p className="text-[10px] text-[#a1a1aa]">kcal</p>
                    </div>
                    {(plan.dailyProteinG || plan.dailyCarbsG || plan.dailyFatG) && (
                      <>
                        <div className="w-px h-8 bg-[#2a2a2a]"></div>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {plan.dailyProteinG && (
                            <span className="text-[#3b82f6]" data-testid="daily-protein-target">P {plan.dailyProteinG}g</span>
                          )}
                          {plan.dailyCarbsG && (
                            <span className="text-[#f59e0b]" data-testid="daily-carbs-target">C {plan.dailyCarbsG}g</span>
                          )}
                          {plan.dailyFatG && (
                            <span className="text-[#ef4444]" data-testid="daily-fat-target">F {plan.dailyFatG}g</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {plan.pdfUrl && (
                <a
                  href={plan.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:border-[#f97316]/50 hover:bg-[#f97316]/10 hover:text-[#f97316]"
                  data-testid="download-pdf-button"
                  aria-label="Download meal plan as PDF"
                  title="Download PDF"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>PDF</span>
                </a>
              )}
              <Link
                href="/meal-plan/history"
                className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-[#a1a1aa] transition-colors hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/10 hover:text-[#3b82f6]"
                data-testid="view-history-button"
                aria-label="View plan history"
                title="View plan history"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>History</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mx-auto max-w-[1600px] px-4 pt-6">
        <div className="flex gap-2 border-b border-[#2a2a2a]" data-testid="meal-plan-tabs">
          <button
            onClick={() => setActiveTab('meal-plan')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'meal-plan'
                ? 'border-[#f97316] text-[#f97316]'
                : 'border-transparent text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3a3a3a]'
            }`}
            data-testid="tab-meal-plan"
            aria-label="View meal plan"
            aria-selected={activeTab === 'meal-plan'}
          >
            📅 Meal Plan
          </button>
          <button
            onClick={() => setActiveTab('grocery-list')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'grocery-list'
                ? 'border-[#f97316] text-[#f97316]'
                : 'border-transparent text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3a3a3a]'
            }`}
            data-testid="tab-grocery-list"
            aria-label="View grocery list"
            aria-selected={activeTab === 'grocery-list'}
          >
            🛒 Grocery List
          </button>
        </div>
      </div>

      {/* 7-day grid - Responsive layout */}
      {activeTab === 'meal-plan' && (
      <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="meal-plan-view">
        {/* Desktop: 7 columns (xl+), Tablet: 3-4 columns (md-lg), Mobile: swipeable cards (xs-sm) */}
        <div
          className="
            /* Mobile: horizontal scroll with snap (swipeable cards) */
            flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory
            /* md: grid with 3 columns */
            md:grid md:grid-cols-3 md:overflow-x-visible md:pb-0
            /* lg: grid with 4 columns */
            lg:grid-cols-4
            /* xl: grid with 5 columns */
            xl:grid-cols-5
            /* 2xl: full 7 columns grid */
            2xl:grid-cols-7
          "
          data-testid="seven-day-grid"
        >
          {days.map((day) => (
            <div
              key={day.dayNumber}
              className="
                /* Mobile: min-width for swipeable cards with snap alignment */
                min-w-[280px] snap-start
                /* md+: remove min-width, use grid columns */
                md:min-w-0
              "
            >
              <DayColumn
                day={day}
                swappingMeal={swappingMeal}
                swapSuccess={swapSuccess}
                swapInProgress={swapLoading || swappingMeal !== null}
                onSwapClick={handleSwapClick}
                onMealClick={(dayNumber, mealIdx, meal) => setSelectedMeal({ dayNumber, mealIdx, meal })}
                onUndoClick={handleUndoClick}
              />
            </div>
          ))}
        </div>

        {days.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#a1a1aa]">No meal plan data available.</p>
          </div>
        )}
      </div>
      )}

      {/* Grocery List View */}
      {activeTab === 'grocery-list' && (
        <div className="mx-auto max-w-[1600px] px-4 py-6" data-testid="grocery-list-view">
          {plan.validatedPlan?.groceryList && plan.validatedPlan.groceryList.length > 0 ? (
            <GroceryListSection groceryList={normalizeGroceryList(plan.validatedPlan.groceryList as unknown[])} />
          ) : (
            <div className="text-center py-12">
              <p className="text-[#a1a1aa]">No grocery list available.</p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>

    {/* Swap modal */}
    {swapTarget && (
      <SwapModal
        target={swapTarget}
        alternatives={swapAlternatives}
        loading={swapLoading}
        onSelect={handleSwapSelect}
        onClose={handleSwapClose}
      />
    )}

    {/* Swap error toast */}
    {swapError && (
      <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 shadow-lg" data-testid="swap-error-toast">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-500">Meal Swap Failed</p>
            <p className="mt-1 text-xs text-red-400">{swapError}</p>
          </div>
          <button
            onClick={() => setSwapError(null)}
            className="flex-shrink-0 rounded text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Dismiss error"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    )}

    {/* Meal detail modal */}
    {selectedMeal && (
      <MealDetailModal
        meal={selectedMeal.meal}
        dayNumber={selectedMeal.dayNumber}
        mealIdx={selectedMeal.mealIdx}
        onClose={() => setSelectedMeal(null)}
      />
    )}
    </>
  );
}
