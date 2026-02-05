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
  const [allergyInput, setAllergyInput] = useState("");

  const toggleAllergy = (allergy: string) => {
    const lower = allergy.toLowerCase();
    const current = data.allergies;
    if (current.includes(lower)) {
      updateData({ allergies: current.filter((a) => a !== lower) });
    } else {
      updateData({ allergies: [...current, lower] });
    }
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim().toLowerCase();
    if (trimmed && !data.allergies.includes(trimmed)) {
      updateData({ allergies: [...data.allergies, trimmed] });
      setAllergyInput("");
    }
  };

  const removeAllergy = (allergy: string) => {
    updateData({ allergies: data.allergies.filter((a) => a !== allergy) });
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
      <p className="text-sm text-muted-foreground">
        Your dietary preferences help us curate meals you&apos;ll enjoy.
      </p>

      {/* Dietary Style */}
      <div>
        <label id="onboarding-dietary-style-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
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
              className={`rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.dietaryStyle === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label id="onboarding-allergies-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Allergies (select common or add custom)
        </label>

        {/* Common allergy quick-select buttons */}
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-labelledby="onboarding-allergies-label">
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
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors min-h-[44px] max-w-[200px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                data.allergies.includes(allergy.toLowerCase())
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
              title={allergy}
            >
              {allergy}
            </button>
          ))}
        </div>

        {/* Custom allergy input field */}
        <div className="flex gap-2">
          <input
            id="onboarding-allergies-custom"
            type="text"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAllergy()}
            placeholder="Type custom allergy and press Enter"
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <button
            type="button"
            onClick={addAllergy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addAllergy();
              }
            }}
            className="rounded-lg bg-border px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Add
          </button>
        </div>

        {/* Allergy chips display */}
        {data.allergies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Selected allergies">
            {data.allergies.map((allergy) => (
              <span
                key={allergy}
                className="inline-flex flex-shrink-0 max-w-[250px] items-center gap-1 rounded-full border border-destructive bg-destructive/10 px-3 py-1 text-xs text-destructive"
                role="listitem"
                title={allergy}
              >
                <span className="truncate">{allergy}</span>
                <button
                  type="button"
                  onClick={() => removeAllergy(allergy)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeAllergy(allergy);
                    }
                  }}
                  className="ml-1 flex-shrink-0 hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded"
                  aria-label={`Remove ${allergy} from allergies`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Exclusions */}
      <div>
        <label htmlFor="onboarding-exclusions" className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
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
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
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
            className="rounded-lg bg-border px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Add
          </button>
        </div>
        {data.exclusions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.exclusions.map((item) => (
              <span
                key={item}
                className="inline-flex flex-shrink-0 max-w-[250px] items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
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
                  className="ml-1 flex-shrink-0 text-destructive hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded"
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
