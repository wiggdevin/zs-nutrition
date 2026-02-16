'use client';

import type { MealSlot, FoodDetails, FoodServing } from './types';
import { LogMealForm } from './LogMealForm';

interface FoodDetailsPanelProps {
  selectedFood: FoodDetails;
  currentServing: FoodServing | undefined;
  selectedServingIdx: number;
  quantity: number;
  mealSlot: MealSlot | '';
  loggedDate: string;
  isLogging: boolean;
  logSuccess: string | null;
  logError: string | null;
  isLogNetworkError: boolean;
  onServingChange: (idx: number) => void;
  onQuantityChange: (qty: number) => void;
  onMealSlotChange: (slot: MealSlot | '') => void;
  onDateChange: (date: string) => void;
  onLogFood: () => void;
  onClose: () => void;
}

export function FoodDetailsPanel({
  selectedFood,
  currentServing,
  selectedServingIdx,
  quantity,
  mealSlot,
  loggedDate,
  isLogging,
  logSuccess,
  logError,
  isLogNetworkError,
  onServingChange,
  onQuantityChange,
  onMealSlotChange,
  onDateChange,
  onLogFood,
  onClose,
}: FoodDetailsPanelProps) {
  return (
    <div className="mt-4 p-4 sm:p-6 bg-card border border-border rounded-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1 mr-2">
          <h3 className="text-lg font-bold text-foreground break-words">{selectedFood.name}</h3>
          {selectedFood.brandName && (
            <p className="text-sm text-primary">{selectedFood.brandName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close food details"
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

      {/* Serving Size Selector */}
      {selectedFood.servings.length > 0 && (
        <div className="mb-4">
          <label
            id="food-serving-size-label"
            className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
          >
            Serving Size
          </label>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="food-serving-size-label"
          >
            {selectedFood.servings.map((serving, idx) => (
              <button
                key={serving.servingId}
                onClick={() => onServingChange(idx)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors max-w-[200px] ${
                  selectedServingIdx === idx
                    ? 'bg-primary text-background'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
                title={serving.servingDescription}
              >
                <span className="truncate block">{serving.servingDescription}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nutrition Info */}
      {currentServing && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {currentServing.calories}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Calories
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-400">
              {currentServing.protein}g
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Protein
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-400">
              {currentServing.carbohydrate}g
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Carbs
            </div>
          </div>
          <div className="bg-background rounded-lg p-2 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">
              {currentServing.fat}g
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Fat
            </div>
          </div>
        </div>
      )}

      {currentServing?.fiber !== undefined && currentServing.fiber !== null && (
        <div className="mt-3 text-sm text-muted-foreground">
          Fiber: <span className="text-foreground font-medium">{currentServing.fiber}g</span>
        </div>
      )}

      {/* Log Meal Form */}
      {currentServing && (
        <LogMealForm
          currentServing={currentServing}
          quantity={quantity}
          mealSlot={mealSlot}
          loggedDate={loggedDate}
          isLogging={isLogging}
          logSuccess={logSuccess}
          logError={logError}
          isLogNetworkError={isLogNetworkError}
          onQuantityChange={onQuantityChange}
          onMealSlotChange={onMealSlotChange}
          onDateChange={onDateChange}
          onLogFood={onLogFood}
        />
      )}
    </div>
  );
}
