'use client';

import { X, Check, AlertCircle } from 'lucide-react';
import { FoodAnalysisResult } from '@/lib/vision/claude-vision';

interface ReviewStateProps {
  adjustedResult: FoodAnalysisResult;
  imageData: string | null;
  onReset: () => void;
  onConfirm: () => void;
  onAdjust: (field: keyof FoodAnalysisResult['estimated_nutrition'], value: string) => void;
  onNameChange: (name: string) => void;
  nutritionBounds: Record<string, { min: number; max: number }>;
}

export function ReviewState({
  adjustedResult,
  imageData,
  onReset,
  onConfirm,
  onAdjust,
  onNameChange,
  nutritionBounds,
}: ReviewStateProps) {
  const confidenceColor =
    adjustedResult.confidence_score >= 80
      ? 'text-success'
      : adjustedResult.confidence_score >= 60
        ? 'text-warning'
        : 'text-destructive';

  return (
    <div
      className="bg-card border border-border rounded-xl p-6 mb-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading uppercase tracking-wider">Review Analysis</h3>
        <button
          onClick={onReset}
          aria-label="Discard analysis and start over"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Image */}
      {imageData && (
        <div className="mb-4 rounded-lg overflow-hidden border border-border">
          <img src={imageData} alt="Captured meal" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Meal Name */}
      <div className="mb-4">
        <label
          htmlFor="scan-meal-name"
          className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-2 block"
        >
          Meal Name
        </label>
        <input
          id="scan-meal-name"
          type="text"
          value={adjustedResult.meal_name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Description */}
      {adjustedResult.description && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">{adjustedResult.description}</p>
        </div>
      )}

      {/* Confidence Score */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          Confidence:
        </span>
        <span className={`text-sm font-bold ${confidenceColor}`}>
          {adjustedResult.confidence_score}%
        </span>
      </div>

      {/* Nutrition Estimates - Editable */}
      <div className="mb-4">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
          {'/// Estimated Nutrition (Click to Edit)'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="scan-calories" className="text-xs text-muted-foreground block mb-1">
              Calories
            </label>
            <input
              id="scan-calories"
              type="number"
              min={nutritionBounds.calories?.min ?? 0}
              max={nutritionBounds.calories?.max ?? 5000}
              value={Math.round(adjustedResult.estimated_nutrition.calories)}
              onChange={(e) => onAdjust('calories', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="scan-protein" className="text-xs text-muted-foreground block mb-1">
              Protein (g)
            </label>
            <input
              id="scan-protein"
              type="number"
              min={nutritionBounds.protein_g?.min ?? 0}
              max={nutritionBounds.protein_g?.max ?? 300}
              value={Math.round(adjustedResult.estimated_nutrition.protein_g)}
              onChange={(e) => onAdjust('protein_g', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-chart-3"
            />
          </div>
          <div>
            <label htmlFor="scan-carbs" className="text-xs text-muted-foreground block mb-1">
              Carbs (g)
            </label>
            <input
              id="scan-carbs"
              type="number"
              min={nutritionBounds.carbs_g?.min ?? 0}
              max={nutritionBounds.carbs_g?.max ?? 500}
              value={Math.round(adjustedResult.estimated_nutrition.carbs_g)}
              onChange={(e) => onAdjust('carbs_g', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-success"
            />
          </div>
          <div>
            <label htmlFor="scan-fat" className="text-xs text-muted-foreground block mb-1">
              Fat (g)
            </label>
            <input
              id="scan-fat"
              type="number"
              min={nutritionBounds.fat_g?.min ?? 0}
              max={nutritionBounds.fat_g?.max ?? 300}
              value={Math.round(adjustedResult.estimated_nutrition.fat_g)}
              onChange={(e) => onAdjust('fat_g', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-warning"
            />
          </div>
        </div>
      </div>

      {/* Detected Ingredients */}
      {adjustedResult.ingredients && adjustedResult.ingredients.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-2">
            Detected Ingredients
          </p>
          <div className="space-y-1">
            {adjustedResult.ingredients.map((ingredient, idx) => (
              <div key={idx} className="text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-foreground">{ingredient.name}</span>
                <span className="text-muted-foreground">({ingredient.amount})</span>
                {ingredient.confidence === 'high' && (
                  <span className="text-xs text-success">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {adjustedResult.warnings && adjustedResult.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-warning">
              {adjustedResult.warnings.map((warning, idx) => (
                <p key={idx}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          aria-label="Cancel analysis and start over"
          className="flex-1 bg-border hover:bg-secondary text-foreground font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          aria-label="Confirm and log this meal"
          className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          Log Meal
        </button>
      </div>
    </div>
  );
}
