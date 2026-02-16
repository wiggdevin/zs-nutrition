'use client';

import { useState } from 'react';

export interface PortionAdjustModalProps {
  mealName: string;
  currentPortion: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  onConfirm: (newPortion: number) => void;
  onCancel: () => void;
  isAdjusting: boolean;
}

export default function PortionAdjustModal({
  mealName,
  currentPortion,
  calories,
  protein,
  carbs,
  fat,
  onConfirm,
  onCancel,
  isAdjusting,
}: PortionAdjustModalProps) {
  const [portion, setPortion] = useState(currentPortion);

  // Calculate base nutrition (per 1.0 portion)
  const baseKcal = Math.round(calories / currentPortion);
  const baseProtein = Math.round((protein / currentPortion) * 10) / 10;
  const baseCarbs = Math.round((carbs / currentPortion) * 10) / 10;
  const baseFat = Math.round((fat / currentPortion) * 10) / 10;

  // Calculate adjusted nutrition
  const adjustedKcal = Math.round(baseKcal * portion);
  const adjustedProtein = Math.round(baseProtein * portion * 10) / 10;
  const adjustedCarbs = Math.round(baseCarbs * portion * 10) / 10;
  const adjustedFat = Math.round(baseFat * portion * 10) / 10;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-portion-title"
    >
      <div
        data-testid="adjust-portion-modal"
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        role="document"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-1">
          /// Adjust Portion
        </p>
        <h3 id="adjust-portion-title" className="text-lg font-bold text-foreground mb-4">
          {mealName}
        </h3>

        {/* Portion Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted-foreground">Portion</label>
            <span data-testid="adjust-portion-value" className="text-sm font-bold text-primary">
              {portion}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={portion}
            onChange={(e) => setPortion(parseFloat(e.target.value))}
            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            data-testid="adjust-portion-slider"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.5x</span>
            <span>1x</span>
            <span>2x</span>
            <span>3x</span>
          </div>
        </div>

        {/* Nutrition Preview */}
        <div className="bg-background border border-border rounded-xl p-4 mb-6">
          <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
            Adjusted Nutrition
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Calories</span>
              <span className="text-sm font-bold text-foreground ml-auto">{adjustedKcal} kcal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-chart-3" />
              <span className="text-xs text-muted-foreground">Protein</span>
              <span className="text-sm font-bold text-foreground ml-auto">{adjustedProtein}g</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">Carbs</span>
              <span className="text-sm font-bold text-foreground ml-auto">{adjustedCarbs}g</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-xs text-muted-foreground">Fat</span>
              <span className="text-sm font-bold text-foreground ml-auto">{adjustedFat}g</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isAdjusting}
            className="flex-1 px-4 py-3 bg-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(portion)}
            disabled={isAdjusting}
            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold rounded-lg transition-colors"
            data-testid="adjust-portion-confirm"
          >
            {isAdjusting ? 'Adjusting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
