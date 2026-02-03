"use client";

import { OnboardingData, ActivityLevel, Weekday } from "@/lib/onboarding-types";

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
}

const activityLevels: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: "sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
  { value: "lightly_active", label: "Lightly Active", desc: "Light exercise 1-3 days/week" },
  { value: "moderately_active", label: "Moderately Active", desc: "Moderate exercise 3-5 days/week" },
  { value: "very_active", label: "Very Active", desc: "Hard exercise 6-7 days/week" },
  { value: "extremely_active", label: "Extremely Active", desc: "Athlete or very physical job" },
];

const weekdays: { value: Weekday; label: string }[] = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
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
      <p className="text-sm text-[#a1a1aa]">
        Your activity level affects your calorie targets and training day adjustments.
      </p>

      {/* Activity Level */}
      <div>
        <label id="onboarding-activity-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Activity Level
        </label>
        <div className="space-y-2">
          {activityLevels.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => updateData({ activityLevel: value })}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                data.activityLevel === value
                  ? "border-[#f97316] bg-[#f97316]/10"
                  : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]"
              }`}
            >
              <span className={`block text-sm font-bold ${data.activityLevel === value ? "text-[#f97316]" : "text-[#fafafa]"}`}>
                {label}
              </span>
              <span className="block text-xs text-[#a1a1aa]">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Training Days */}
      <div>
        <label id="onboarding-training-days-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Training Days
        </label>
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleTrainingDay(value)}
              className={`rounded-lg border px-2 py-3 text-center text-xs font-bold uppercase transition-colors ${
                data.trainingDays.includes(value)
                  ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                  : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cooking Skill */}
      <div>
        <label htmlFor="onboarding-cooking-skill" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
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
          className="w-full accent-[#f97316]"
        />
        <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
          <span>Beginner</span>
          <span>Expert</span>
        </div>
      </div>

      {/* Prep Time */}
      <div>
        <label htmlFor="onboarding-prep-time" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
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
          className="w-full accent-[#f97316]"
        />
        <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
          <span>10 min</span>
          <span>120 min</span>
        </div>
      </div>
    </div>
  );
}
