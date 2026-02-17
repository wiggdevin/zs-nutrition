'use client';

interface NutritionInputsProps {
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

export default function NutritionInputs({
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
}: NutritionInputsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label
          htmlFor="manual-calories"
          className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1.5"
        >
          Calories *
        </label>
        <input
          id="manual-calories"
          type="number"
          min="0"
          step="1"
          value={calories}
          onChange={(e) => {
            setCalories(e.target.value);
            if (
              fieldErrors.calories &&
              e.target.value &&
              !isNaN(Number(e.target.value)) &&
              Number(e.target.value) >= 0
            ) {
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.calories;
                return next;
              });
            }
          }}
          placeholder="0"
          aria-invalid={!!fieldErrors.calories}
          aria-describedby={fieldErrors.calories ? 'manual-calories-error' : undefined}
          className={`w-full px-3 py-2.5 bg-background border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none transition-colors ${
            fieldErrors.calories
              ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
          }`}
          data-testid="manual-calories"
        />
        {fieldErrors.calories && (
          <p
            id="manual-calories-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {fieldErrors.calories}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="manual-protein"
          className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5"
        >
          Protein (g){' '}
          <span className="text-muted-foreground normal-case font-normal">(optional)</span>
        </label>
        <input
          id="manual-protein"
          type="number"
          min="0"
          step="0.1"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
          data-testid="manual-protein"
        />
      </div>
      <div>
        <label
          htmlFor="manual-carbs"
          className="block text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5"
        >
          Carbs (g){' '}
          <span className="text-muted-foreground normal-case font-normal">(optional)</span>
        </label>
        <input
          id="manual-carbs"
          type="number"
          min="0"
          step="0.1"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors"
          data-testid="manual-carbs"
        />
      </div>
      <div>
        <label
          htmlFor="manual-fat"
          className="block text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1.5"
        >
          Fat (g) <span className="text-muted-foreground normal-case font-normal">(optional)</span>
        </label>
        <input
          id="manual-fat"
          type="number"
          min="0"
          step="0.1"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
          data-testid="manual-fat"
        />
      </div>
    </div>
  );
}
