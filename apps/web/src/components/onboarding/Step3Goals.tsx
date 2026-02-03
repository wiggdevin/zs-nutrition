"use client";

import { OnboardingData, GoalType } from "@/lib/onboarding-types";

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  showErrors?: boolean;
}

const goalDescriptions: Record<GoalType, string> = {
  cut: "Lose body fat while preserving muscle",
  maintain: "Stay at your current weight and body composition",
  bulk: "Build muscle with a caloric surplus",
};

export function isStep3Valid(data: OnboardingData): boolean {
  return data.goalType !== '';
}

export function Step3Goals({ data, updateData, showErrors }: Props) {
  const isMaintain = data.goalType === "maintain";
  const sliderDisabled = isMaintain;
  const displayRate = isMaintain ? 0 : data.goalRate;

  const handleGoalSelect = (goal: GoalType) => {
    if (goal === "maintain") {
      updateData({ goalType: goal, goalRate: 0 });
    } else {
      // If switching from maintain, reset to default rate
      updateData({ goalType: goal, goalRate: data.goalRate === 0 ? 1 : data.goalRate });
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#a1a1aa]">
        What&apos;s your primary nutrition goal? This determines your calorie
        target.
      </p>

      {/* Goal Type */}
      <div>
        <label id="onboarding-goal-type-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Goal Type
        </label>
        {showErrors && !data.goalType && (
          <p className="mb-2 text-xs text-red-500">Please select a goal type</p>
        )}
        <div className="space-y-3">
          {(["cut", "maintain", "bulk"] as GoalType[]).map((goal) => (
            <button
              key={goal}
              onClick={() => handleGoalSelect(goal)}
              className={`w-full rounded-lg border px-4 py-4 text-left transition-colors ${
                data.goalType === goal
                  ? "border-[#f97316] bg-[#f97316]/10"
                  : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]"
              } ${showErrors && !data.goalType ? "border-red-500/50" : ""}`}
            >
              <span
                className={`block text-sm font-bold uppercase tracking-wide ${
                  data.goalType === goal ? "text-[#f97316]" : "text-[#fafafa]"
                }`}
              >
                {goal}
              </span>
              <span className="mt-1 block text-xs text-[#a1a1aa]">
                {goalDescriptions[goal]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Goal Rate - always shown when goal selected, disabled for maintain */}
      {data.goalType && (
        <div>
          <label htmlFor="onboarding-goal-rate" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            {isMaintain
              ? "Rate: N/A (maintaining weight)"
              : `${data.goalType === "cut" ? "Weight Loss" : "Weight Gain"} Rate: ${displayRate} lbs/week`}
          </label>
          <input
            id="onboarding-goal-rate"
            type="range"
            value={displayRate}
            onChange={(e) =>
              updateData({ goalRate: parseFloat(e.target.value) })
            }
            min={0}
            max={2}
            step={0.25}
            disabled={sliderDisabled}
            className={`w-full accent-[#f97316] ${sliderDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
          />
          <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
            <span>0 lbs/wk</span>
            <span>2 lbs/wk (Aggressive)</span>
          </div>
        </div>
      )}
    </div>
  );
}
