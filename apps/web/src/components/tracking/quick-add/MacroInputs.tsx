'use client';

import { numericKeyFilter } from './useQuickAdd';

interface MacroInputsProps {
  calories: string;
  setCalories: (v: string) => void;
  protein: string;
  setProtein: (v: string) => void;
  carbs: string;
  setCarbs: (v: string) => void;
  fat: string;
  setFat: (v: string) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function MacroInputs({
  calories,
  setCalories,
  protein,
  setProtein,
  carbs,
  setCarbs,
  fat,
  setFat,
  fieldErrors,
  setFieldErrors,
}: MacroInputsProps) {
  return (
    <>
      {/* Calories - required */}
      <div>
        <label
          htmlFor="quick-add-calories"
          className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1.5"
        >
          Calories <span className="text-primary">*</span>
        </label>
        <input
          id="quick-add-calories"
          type="number"
          inputMode="numeric"
          value={calories}
          onChange={(e) => {
            setCalories(e.target.value);
            if (fieldErrors.calories) {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= 10000) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.calories;
                  return next;
                });
              }
            }
          }}
          onKeyDown={(e) => numericKeyFilter(e)}
          placeholder="Enter calories"
          min="1"
          max="10000"
          required
          aria-invalid={!!fieldErrors.calories}
          aria-describedby={fieldErrors.calories ? 'quick-add-calories-error' : undefined}
          className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors text-lg font-semibold ${
            fieldErrors.calories
              ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
          }`}
          data-testid="quick-add-calories"
        />
        {fieldErrors.calories && (
          <p
            id="quick-add-calories-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {fieldErrors.calories}
          </p>
        )}
      </div>

      {/* Optional macros in a row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="quick-add-protein"
            className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5"
          >
            Protein <span className="text-muted-foreground normal-case font-normal">(g)</span>
          </label>
          <input
            id="quick-add-protein"
            type="number"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            onKeyDown={(e) => numericKeyFilter(e, true)}
            placeholder="0"
            min="0"
            max="1000"
            step="0.1"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            data-testid="quick-add-protein"
          />
        </div>
        <div>
          <label
            htmlFor="quick-add-carbs"
            className="block text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5"
          >
            Carbs <span className="text-muted-foreground normal-case font-normal">(g)</span>
          </label>
          <input
            id="quick-add-carbs"
            type="number"
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            onKeyDown={(e) => numericKeyFilter(e, true)}
            placeholder="0"
            min="0"
            max="1000"
            step="0.1"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
            data-testid="quick-add-carbs"
          />
        </div>
        <div>
          <label
            htmlFor="quick-add-fat"
            className="block text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1.5"
          >
            Fat <span className="text-muted-foreground normal-case font-normal">(g)</span>
          </label>
          <input
            id="quick-add-fat"
            type="number"
            inputMode="decimal"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            onKeyDown={(e) => numericKeyFilter(e, true)}
            placeholder="0"
            min="0"
            max="1000"
            step="0.1"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
            data-testid="quick-add-fat"
          />
        </div>
      </div>
    </>
  );
}
