"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[#2a2a2a]"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuenow={currentStep}
        aria-valuemax={totalSteps}
        aria-valuetext={`Step ${currentStep} of ${totalSteps}`}
      >
        <div
          className="h-full rounded-full bg-[#f97316] transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i + 1 <= currentStep
                ? "bg-[#f97316] text-[#0a0a0a]"
                : "bg-[#2a2a2a] text-[#a1a1aa]"
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
