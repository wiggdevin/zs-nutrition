'use client';

import { useState } from 'react';
import type { PlanMeal } from './types';

export interface LogConfirmModalProps {
  meal: PlanMeal;
  onConfirm: (portion: number) => void;
  onCancel: () => void;
  isLogging: boolean;
}

export default function LogConfirmModal({
  meal,
  onConfirm,
  onCancel,
  isLogging,
}: LogConfirmModalProps) {
  const [portion, setPortion] = useState(1.0);

  const adjustedCalories = Math.round(meal.calories * portion);
  const adjustedProtein = Math.round(meal.protein * portion * 10) / 10;
  const adjustedCarbs = Math.round(meal.carbs * portion * 10) / 10;
  const adjustedFat = Math.round(meal.fat * portion * 10) / 10;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-meal-title"
    >
      <div
        data-testid="log-confirm-modal"
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        role="document"
      >
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-1">
          /// Log Meal
        </p>
        <h3 id="log-meal-title" className="text-lg font-bold text-foreground mb-4">
          {meal.name}
        </h3>

        {/* Portion Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted-foreground">Portion</label>
            <span data-testid="portion-value" className="text-sm font-bold text-primary">
              {portion.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            value={portion}
            onChange={(e) => setPortion(parseFloat(e.target.value))}
            data-testid="portion-slider"
            className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0.25×</span>
            <span>1×</span>
            <span>2×</span>
            <span>3×</span>
          </div>
        </div>

        {/* Auto-filled Nutrition Preview */}
        <div
          data-testid="nutrition-preview"
          className="card-elevation border border-border rounded-xl p-4 mb-6"
        >
          <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
            Nutrition
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Calories</span>
              <span
                data-testid="preview-calories"
                className="text-sm font-bold text-foreground ml-auto"
              >
                {adjustedCalories} kcal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-chart-3" />
              <span className="text-sm text-muted-foreground">Protein</span>
              <span
                data-testid="preview-protein"
                className="text-sm font-bold text-foreground ml-auto"
              >
                {adjustedProtein}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Carbs</span>
              <span
                data-testid="preview-carbs"
                className="text-sm font-bold text-foreground ml-auto"
              >
                {adjustedCarbs}g
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-sm text-muted-foreground">Fat</span>
              <span data-testid="preview-fat" className="text-sm font-bold text-foreground ml-auto">
                {adjustedFat}g
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLogging}
            className="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide border border-border text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(portion)}
            disabled={isLogging}
            data-testid="confirm-log-btn"
            aria-label={`Confirm logging ${meal.name}`}
            className="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-background rounded-xl transition-colors"
          >
            {isLogging ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Logging...</span>
              </span>
            ) : (
              'Confirm Log'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
