"use client";

import { OnboardingData, Sex } from "@/lib/onboarding-types";

/** Block non-numeric keys on number inputs (letters, special chars). Allows digits, navigation, and control keys. */
function numericKeyFilter(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = false) {
  const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End', 'Enter'];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return; // Allow copy/paste/select-all shortcuts
  if (allowDecimal && e.key === '.') return;
  if (e.key === '-') return; // Allow minus for negative (browser handles validation)
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  showErrors?: boolean;
}

export function validateStep1(data: OnboardingData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = "Name is required";
  }
  if (!data.sex) {
    errors.sex = "Please select your biological sex";
  }
  if (data.age === null || data.age === undefined) {
    errors.age = "Age is required";
  } else if (data.age < 18 || data.age > 100) {
    errors.age = "Age must be between 18 and 100";
  }
  return errors;
}

export function isStep1Valid(data: OnboardingData): boolean {
  return Object.keys(validateStep1(data)).length === 0;
}

export function Step1Demographics({ data, updateData, showErrors = false }: Props) {
  const errors = validateStep1(data);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#a1a1aa]">
        Tell us a bit about yourself so we can personalize your nutrition plan.
      </p>

      {/* Name */}
      <div>
        <label htmlFor="onboarding-name" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Name <span className="text-[#f97316]">*</span>
        </label>
        <input
          id="onboarding-name"
          type="text"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          placeholder="Enter your name"
          aria-invalid={showErrors && !!errors.name}
          aria-describedby={showErrors && errors.name ? "onboarding-name-error" : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
            showErrors && errors.name
              ? "border-red-500 focus:border-red-500"
              : "border-[#2a2a2a] focus:border-[#f97316]"
          }`}
        />
        {showErrors && errors.name && (
          <p id="onboarding-name-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            {errors.name}
          </p>
        )}
      </div>

      {/* Sex */}
      <div>
        <label id="onboarding-sex-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Biological Sex <span className="text-[#f97316]">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="onboarding-sex-label" aria-invalid={showErrors && !!errors.sex}>
          {(["male", "female"] as Sex[]).map((sex) => (
            <button
              key={sex}
              type="button"
              onClick={() => updateData({ sex })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateData({ sex });
                }
              }}
              role="radio"
              aria-checked={data.sex === sex}
              className={`rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                data.sex === sex
                  ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                  : showErrors && errors.sex
                    ? "border-red-500 bg-[#1e1e1e] text-[#a1a1aa] hover:border-red-400"
                    : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
              }`}
            >
              {sex}
            </button>
          ))}
        </div>
        {showErrors && errors.sex && (
          <p id="onboarding-sex-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            {errors.sex}
          </p>
        )}
      </div>

      {/* Age */}
      <div>
        <label htmlFor="onboarding-age" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Age <span className="text-[#f97316]">*</span>
        </label>
        <input
          id="onboarding-age"
          type="number"
          inputMode="numeric"
          value={data.age ?? ""}
          onChange={(e) =>
            updateData({ age: e.target.value ? parseInt(e.target.value) : null })
          }
          onKeyDown={(e) => numericKeyFilter(e)}
          placeholder="Enter your age"
          min={18}
          max={100}
          data-testid="onboarding-age"
          aria-invalid={showErrors && !!errors.age}
          aria-describedby={showErrors && errors.age ? "onboarding-age-error" : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
            showErrors && errors.age
              ? "border-red-500 focus:border-red-500"
              : "border-[#2a2a2a] focus:border-[#f97316]"
          }`}
        />
        {showErrors && errors.age && (
          <p id="onboarding-age-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            {errors.age}
          </p>
        )}
      </div>
    </div>
  );
}
