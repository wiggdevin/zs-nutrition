'use client';

import { OnboardingData, MacroStyle } from '@/lib/onboarding-types';

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
}

const macroStyles: { value: MacroStyle; label: string; desc: string }[] = [
  { value: 'balanced', label: 'Balanced', desc: '30P / 40C / 30F — General health' },
  { value: 'high_protein', label: 'High Protein', desc: '40P / 35C / 25F — Muscle building' },
  { value: 'low_carb', label: 'Low Carb', desc: '35P / 25C / 40F — Fat adaptation' },
  { value: 'keto', label: 'Keto', desc: '30P / 5C / 65F — Ketogenic' },
];

const cuisineOptions = [
  'American',
  'Italian',
  'Mexican',
  'Asian',
  'Mediterranean',
  'Indian',
  'Japanese',
  'Thai',
  'Greek',
  'Middle Eastern',
  'Korean',
  'French',
];

export function Step6Preferences({ data, updateData }: Props) {
  const toggleCuisine = (cuisine: string) => {
    const lower = cuisine.toLowerCase();
    const current = data.cuisinePreferences;
    if (current.includes(lower)) {
      updateData({ cuisinePreferences: current.filter((c) => c !== lower) });
    } else {
      updateData({ cuisinePreferences: [...current, lower] });
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Final step! Choose your macro split and meal preferences.
      </p>

      {/* Macro Style */}
      <div>
        <label
          id="onboarding-macro-split-label"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Macro Split
        </label>
        <div className="space-y-2" role="radiogroup" aria-labelledby="onboarding-macro-split-label">
          {macroStyles.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData({ macroStyle: value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateData({ macroStyle: value });
                }
              }}
              role="radio"
              aria-checked={data.macroStyle === value}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.macroStyle === value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <span
                className={`block text-sm font-bold ${data.macroStyle === value ? 'text-primary' : 'text-foreground'}`}
              >
                {label}
              </span>
              <span className="block text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine Preferences */}
      <div>
        <label
          id="onboarding-cuisine-label"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Cuisine Preferences (select favorites)
        </label>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="onboarding-cuisine-label"
        >
          {cuisineOptions.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              onClick={() => toggleCuisine(cuisine)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleCuisine(cuisine);
                }
              }}
              aria-pressed={data.cuisinePreferences.includes(cuisine.toLowerCase())}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors min-h-[44px] max-w-[180px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.cuisinePreferences.includes(cuisine.toLowerCase())
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80'
              }`}
              title={cuisine}
            >
              {cuisine}
            </button>
          ))}
        </div>
      </div>

      {/* Meals Per Day */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="onboarding-meals-per-day"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Meals/Day: {data.mealsPerDay}
          </label>
          <input
            id="onboarding-meals-per-day"
            type="range"
            value={data.mealsPerDay}
            onChange={(e) => updateData({ mealsPerDay: parseInt(e.target.value) })}
            min={2}
            max={6}
            step={1}
            aria-valuenow={data.mealsPerDay}
            aria-valuemin={2}
            aria-valuemax={6}
            aria-valuetext={`${data.mealsPerDay} meals per day`}
            className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>2</span>
            <span>6</span>
          </div>
        </div>
        <div>
          <label
            htmlFor="onboarding-snacks-per-day"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Snacks/Day: {data.snacksPerDay}
          </label>
          <input
            id="onboarding-snacks-per-day"
            type="range"
            value={data.snacksPerDay}
            onChange={(e) => updateData({ snacksPerDay: parseInt(e.target.value) })}
            min={0}
            max={4}
            step={1}
            aria-valuenow={data.snacksPerDay}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuetext={`${data.snacksPerDay} snacks per day`}
            className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>4</span>
          </div>
        </div>
      </div>

      {/* Ready message */}
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
        <p className="text-sm font-bold text-success">You&apos;re all set!</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click &quot;Complete Setup&quot; to generate your personalized meal plan.
        </p>
      </div>
    </div>
  );
}
