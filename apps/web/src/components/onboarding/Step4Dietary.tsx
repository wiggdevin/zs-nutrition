"use client";

import { useState } from "react";
import { OnboardingData, DietaryStyle } from "@/lib/onboarding-types";

interface Props {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
}

const dietaryStyles: { value: DietaryStyle; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
];

const commonAllergies = [
  "Peanuts",
  "Tree Nuts",
  "Dairy",
  "Eggs",
  "Soy",
  "Wheat",
  "Fish",
  "Shellfish",
  "Sesame",
  "Gluten",
];

export function Step4Dietary({ data, updateData }: Props) {
  const [exclusionInput, setExclusionInput] = useState("");

  const toggleAllergy = (allergy: string) => {
    const lower = allergy.toLowerCase();
    const current = data.allergies;
    if (current.includes(lower)) {
      updateData({ allergies: current.filter((a) => a !== lower) });
    } else {
      updateData({ allergies: [...current, lower] });
    }
  };

  const addExclusion = () => {
    const trimmed = exclusionInput.trim().toLowerCase();
    if (trimmed && !data.exclusions.includes(trimmed)) {
      updateData({ exclusions: [...data.exclusions, trimmed] });
      setExclusionInput("");
    }
  };

  const removeExclusion = (item: string) => {
    updateData({ exclusions: data.exclusions.filter((e) => e !== item) });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#a1a1aa]">
        Your dietary preferences help us curate meals you&apos;ll enjoy.
      </p>

      {/* Dietary Style */}
      <div>
        <label id="onboarding-dietary-style-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Dietary Style
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-labelledby="onboarding-dietary-style-label">
          {dietaryStyles.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData({ dietaryStyle: value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateData({ dietaryStyle: value });
                }
              }}
              role="radio"
              aria-checked={data.dietaryStyle === value}
              className={`rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                data.dietaryStyle === value
                  ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                  : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label id="onboarding-allergies-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Allergies (select all that apply)
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="onboarding-allergies-label">
          {commonAllergies.map((allergy) => (
            <button
              key={allergy}
              type="button"
              onClick={() => toggleAllergy(allergy)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleAllergy(allergy);
                }
              }}
              aria-pressed={data.allergies.includes(allergy.toLowerCase())}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors min-h-[44px] max-w-[200px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
                data.allergies.includes(allergy.toLowerCase())
                  ? "border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]"
                  : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
              }`}
              title={allergy}
            >
              {allergy}
            </button>
          ))}
        </div>
      </div>

      {/* Exclusions */}
      <div>
        <label htmlFor="onboarding-exclusions" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
          Food Exclusions
        </label>
        <div className="flex gap-2">
          <input
            id="onboarding-exclusions"
            type="text"
            value={exclusionInput}
            onChange={(e) => setExclusionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExclusion()}
            placeholder="e.g., mushrooms, cilantro"
            className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-sm text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none focus:border-[#f97316] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
          />
          <button
            type="button"
            onClick={addExclusion}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addExclusion();
              }
            }}
            className="rounded-lg bg-[#2a2a2a] px-4 py-3 text-sm font-bold text-[#fafafa] hover:bg-[#3a3a3a] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
          >
            Add
          </button>
        </div>
        {data.exclusions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.exclusions.map((item) => (
              <span
                key={item}
                className="inline-flex flex-shrink-0 max-w-[250px] items-center gap-1 rounded-full border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-1 text-xs text-[#a1a1aa]"
                title={item}
              >
                <span className="truncate">{item}</span>
                <button
                  type="button"
                  onClick={() => removeExclusion(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeExclusion(item);
                    }
                  }}
                  className="ml-1 flex-shrink-0 text-[#ef4444] hover:text-[#f87171] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] rounded"
                  aria-label={`Remove ${item} from exclusions`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
