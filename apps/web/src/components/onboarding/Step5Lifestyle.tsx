'use client';

import { OnboardingData, ActivityLevel, Weekday } from '@/lib/onboarding-types';

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
}

const activityLevels: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  {
    value: 'moderately_active',
    label: 'Moderately Active',
    desc: 'Moderate exercise 3-5 days/week',
  },
  { value: 'very_active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'extremely_active', label: 'Extremely Active', desc: 'Athlete or very physical job' },
];

const weekdays: { value: Weekday; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export function Step5Lifestyle({ data, updateData }: Props) {
  const toggleTrainingDay = (day: Weekday) => {
    const current = data.trainingDays;
    if (current.includes(day)) {
      updateData({ trainingDays: current.filter((d) => d !== day) });
    } else {
      updateData({ trainingDays: [...current, day] });
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Your activity level affects your calorie targets and training day adjustments.
      </p>

      {/* Activity Level */}
      <div>
        <label
          id="onboarding-activity-label"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Activity Level
        </label>
        <div className="space-y-2" role="radiogroup" aria-labelledby="onboarding-activity-label">
          {activityLevels.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData({ activityLevel: value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateData({ activityLevel: value });
                }
              }}
              role="radio"
              aria-checked={data.activityLevel === value}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.activityLevel === value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <span
                className={`block text-sm font-bold ${data.activityLevel === value ? 'text-primary' : 'text-foreground'}`}
              >
                {label}
              </span>
              <span className="block text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Training Days */}
      <div>
        <label
          id="onboarding-training-days-label"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Training Days
        </label>
        <div
          className="grid grid-cols-7 gap-1 sm:gap-2"
          role="group"
          aria-labelledby="onboarding-training-days-label"
        >
          {weekdays.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleTrainingDay(value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleTrainingDay(value);
                }
              }}
              aria-pressed={data.trainingDays.includes(value)}
              className={`rounded-lg border px-1 sm:px-2 py-3 text-center text-xs font-bold uppercase transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.trainingDays.includes(value)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cooking Skill */}
      <div>
        <label
          htmlFor="onboarding-cooking-skill"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Cooking Skill: {data.cookingSkill}/10
        </label>
        <input
          id="onboarding-cooking-skill"
          type="range"
          value={data.cookingSkill}
          onChange={(e) => updateData({ cookingSkill: parseInt(e.target.value) })}
          min={1}
          max={10}
          step={1}
          aria-valuenow={data.cookingSkill}
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuetext={`Cooking skill level ${data.cookingSkill} out of 10`}
          className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>Beginner</span>
          <span>Expert</span>
        </div>
      </div>

      {/* Prep Time */}
      <div>
        <label
          htmlFor="onboarding-prep-time"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Max Prep Time: {data.prepTimeMax} min
        </label>
        <input
          id="onboarding-prep-time"
          type="range"
          value={data.prepTimeMax}
          onChange={(e) => updateData({ prepTimeMax: parseInt(e.target.value) })}
          min={10}
          max={120}
          step={5}
          aria-valuenow={data.prepTimeMax}
          aria-valuemin={10}
          aria-valuemax={120}
          aria-valuetext={`Maximum prep time ${data.prepTimeMax} minutes`}
          className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>10 min</span>
          <span>120 min</span>
        </div>
      </div>
    </div>
  );
}
