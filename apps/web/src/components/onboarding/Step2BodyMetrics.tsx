"use client";

import { OnboardingData, UnitSystem } from "@/lib/onboarding-types";

/** Block non-numeric keys on number inputs. Allows digits, navigation, and control keys. */
function numericKeyFilter(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = false) {
  const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End', 'Enter'];
  if (allowed.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (allowDecimal && e.key === '.') return;
  if (e.key === '-') return;
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  showErrors?: boolean;
}

// Conversion helpers
function feetInchesToCm(feet: number | null, inches: number | null): number | null {
  if (feet === null && inches === null) return null;
  const totalInches = (feet ?? 0) * 12 + (inches ?? 0);
  if (totalInches === 0) return null;
  return Math.round(totalInches * 2.54 * 10) / 10;
}

function cmToFeetInches(cm: number | null): { feet: number | null; inches: number | null } {
  if (cm === null || cm === 0) return { feet: null, inches: null };
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches: inches === 12 ? 0 : inches };
}

function lbsToKg(lbs: number | null): number | null {
  if (lbs === null) return null;
  return Math.round(lbs * 0.453592 * 10) / 10;
}

function kgToLbs(kg: number | null): number | null {
  if (kg === null) return null;
  return Math.round(kg / 0.453592 * 10) / 10;
}

export function isStep2Valid(data: OnboardingData): boolean {
  if (data.unitSystem === 'imperial') {
    return (
      data.heightFeet !== null &&
      data.heightFeet >= 3 &&
      data.heightFeet <= 8 &&
      data.heightInches !== null &&
      data.heightInches >= 0 &&
      data.heightInches <= 11 &&
      data.weightLbs !== null &&
      data.weightLbs >= 80 &&
      data.weightLbs <= 500
    );
  } else {
    return (
      data.heightCm !== null &&
      data.heightCm >= 90 &&
      data.heightCm <= 250 &&
      data.weightKg !== null &&
      data.weightKg >= 35 &&
      data.weightKg <= 230
    );
  }
}

export function Step2BodyMetrics({ data, updateData, showErrors }: Props) {
  const isImperial = data.unitSystem === "imperial";

  const handleUnitToggle = (unit: UnitSystem) => {
    if (unit === data.unitSystem) return;

    if (unit === "metric") {
      // Convert imperial -> metric
      const cm = feetInchesToCm(data.heightFeet, data.heightInches);
      const kg = lbsToKg(data.weightLbs);
      updateData({
        unitSystem: "metric",
        heightCm: cm,
        weightKg: kg,
      });
    } else {
      // Convert metric -> imperial
      const { feet, inches } = cmToFeetInches(data.heightCm);
      const lbs = kgToLbs(data.weightKg);
      updateData({
        unitSystem: "imperial",
        heightFeet: feet,
        heightInches: inches,
        weightLbs: lbs,
      });
    }
  };

  const heightEmpty = isImperial
    ? data.heightFeet === null || data.heightInches === null
    : data.heightCm === null;
  const heightOutOfRange = isImperial
    ? (data.heightFeet !== null && (data.heightFeet < 3 || data.heightFeet > 8)) ||
      (data.heightInches !== null && (data.heightInches < 0 || data.heightInches > 11))
    : data.heightCm !== null && (data.heightCm < 90 || data.heightCm > 250);
  const heightError = showErrors && (heightEmpty || heightOutOfRange);

  const weightEmpty = isImperial ? data.weightLbs === null : data.weightKg === null;
  const weightOutOfRange = isImperial
    ? data.weightLbs !== null && (data.weightLbs < 80 || data.weightLbs > 500)
    : data.weightKg !== null && (data.weightKg < 35 || data.weightKg > 230);
  const weightError = showErrors && (weightEmpty || weightOutOfRange);

  const bodyFatOutOfRange = data.bodyFatPercent !== null &&
    (data.bodyFatPercent < 3 || data.bodyFatPercent > 60);

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border ${
      hasError ? "border-red-500" : "border-[#2a2a2a]"
    } bg-[#1e1e1e] px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors focus:border-[#f97316] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#a1a1aa]">
        Your body metrics help us calculate accurate calorie and macro targets.
      </p>

      {/* Unit System Toggle */}
      <div>
        <label id="unit-system-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Unit System
        </label>
        <div className="flex gap-2" role="group" aria-labelledby="unit-system-label">
          <button
            type="button"
            onClick={() => handleUnitToggle("imperial")}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUnitToggle("imperial");
              }
            }}
            role="radio"
            aria-checked={isImperial}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
              isImperial
                ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:bg-[#252525]"
            }`}
          >
            Imperial (ft/in, lbs)
          </button>
          <button
            type="button"
            onClick={() => handleUnitToggle("metric")}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleUnitToggle("metric");
              }
            }}
            role="radio"
            aria-checked={!isImperial}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
              !isImperial
                ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:bg-[#252525]"
            }`}
          >
            Metric (cm, kg)
          </button>
        </div>
      </div>

      {/* Height */}
      <div>
        <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Height
        </label>
        {isImperial ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="onboarding-height-feet" className="mb-1 block text-xs text-[#a1a1aa]">Feet</label>
              <input
                id="onboarding-height-feet"
                type="number"
                inputMode="numeric"
                value={data.heightFeet ?? ""}
                onChange={(e) =>
                  updateData({
                    heightFeet: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                onKeyDown={(e) => numericKeyFilter(e)}
                placeholder="5"
                min={3}
                max={8}
                aria-invalid={!!heightError}
                aria-describedby={heightError ? "onboarding-height-error" : undefined}
                className={inputClass(!!heightError)}
              />
            </div>
            <div>
              <label htmlFor="onboarding-height-inches" className="mb-1 block text-xs text-[#a1a1aa]">
                Inches
              </label>
              <input
                id="onboarding-height-inches"
                type="number"
                inputMode="numeric"
                value={data.heightInches ?? ""}
                onChange={(e) =>
                  updateData({
                    heightInches: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                onKeyDown={(e) => numericKeyFilter(e)}
                placeholder="10"
                min={0}
                max={11}
                aria-invalid={!!heightError}
                aria-describedby={heightError ? "onboarding-height-error" : undefined}
                className={inputClass(!!heightError)}
              />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="onboarding-height-cm" className="mb-1 block text-xs text-[#a1a1aa]">
              Centimeters
            </label>
            <input
              id="onboarding-height-cm"
              type="number"
              inputMode="decimal"
              value={data.heightCm ?? ""}
              onChange={(e) =>
                updateData({
                  heightCm: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              onKeyDown={(e) => numericKeyFilter(e, true)}
              placeholder="170"
              min={90}
              max={250}
              step="0.1"
              aria-invalid={!!heightError}
              aria-describedby={heightError ? "onboarding-height-error" : undefined}
              className={inputClass(!!heightError)}
            />
          </div>
        )}
        {heightError && (
          <p id="onboarding-height-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            {heightEmpty
              ? "Height is required"
              : isImperial
              ? "Height must be between 3-8 feet and 0-11 inches"
              : "Height must be between 90 and 250 cm"}
          </p>
        )}
      </div>

      {/* Weight */}
      <div>
        <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Weight
        </label>
        {isImperial ? (
          <div>
            <label htmlFor="onboarding-weight-lbs" className="mb-1 block text-xs text-[#a1a1aa]">Pounds</label>
            <input
              id="onboarding-weight-lbs"
              type="number"
              inputMode="numeric"
              value={data.weightLbs ?? ""}
              onChange={(e) =>
                updateData({
                  weightLbs: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              onKeyDown={(e) => numericKeyFilter(e)}
              placeholder="Enter weight in lbs"
              min={80}
              max={500}
              aria-invalid={!!weightError}
              aria-describedby={weightError ? "onboarding-weight-error" : undefined}
              className={inputClass(!!weightError)}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="onboarding-weight-kg" className="mb-1 block text-xs text-[#a1a1aa]">
              Kilograms
            </label>
            <input
              id="onboarding-weight-kg"
              type="number"
              inputMode="decimal"
              value={data.weightKg ?? ""}
              onChange={(e) =>
                updateData({
                  weightKg: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              onKeyDown={(e) => numericKeyFilter(e, true)}
              placeholder="Enter weight in kg"
              min={35}
              max={230}
              step="0.1"
              aria-invalid={!!weightError}
              aria-describedby={weightError ? "onboarding-weight-error" : undefined}
              className={inputClass(!!weightError)}
            />
          </div>
        )}
        {weightError && (
          <p id="onboarding-weight-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            {weightEmpty
              ? "Weight is required"
              : isImperial
              ? "Weight must be between 80 and 500 lbs"
              : "Weight must be between 35 and 230 kg"}
          </p>
        )}
      </div>

      {/* Body Fat Percentage (Optional) */}
      <div>
        <label htmlFor="onboarding-body-fat" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Body Fat % <span className="normal-case tracking-normal text-[#555]">(optional)</span>
        </label>
        <input
          id="onboarding-body-fat"
          type="number"
          inputMode="decimal"
          value={data.bodyFatPercent ?? ""}
          onChange={(e) =>
            updateData({
              bodyFatPercent: e.target.value
                ? parseFloat(e.target.value)
                : null,
            })
          }
          onKeyDown={(e) => numericKeyFilter(e, true)}
          placeholder="e.g. 15"
          min={3}
          max={60}
          step="0.1"
          aria-invalid={!!bodyFatOutOfRange}
          aria-describedby={bodyFatOutOfRange ? "onboarding-body-fat-error" : undefined}
          className={inputClass(!!bodyFatOutOfRange)}
        />
        {bodyFatOutOfRange && (
          <p id="onboarding-body-fat-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
            Body fat must be between 3% and 60%
          </p>
        )}
        <p className="mt-1 text-xs text-[#555]">
          If known, this helps us calculate your lean body mass for more accurate targets.
        </p>
      </div>
    </div>
  );
}
