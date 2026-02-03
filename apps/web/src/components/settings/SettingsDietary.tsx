"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/lib/toast-store";

type DietaryStyle = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "keto" | "paleo";

const dietaryStyles: { value: DietaryStyle; label: string }[] = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
];

const commonAllergies = [
  "Peanuts", "Tree Nuts", "Dairy", "Eggs", "Soy",
  "Wheat", "Fish", "Shellfish", "Sesame", "Gluten",
];

export default function SettingsDietary() {
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle | "">("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [exclusionInput, setExclusionInput] = useState("");
  const [originalData, setOriginalData] = useState({ dietaryStyle: "" as string, allergies: [] as string[], exclusions: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty = dietaryStyle !== originalData.dietaryStyle ||
    JSON.stringify(allergies) !== JSON.stringify(originalData.allergies) ||
    JSON.stringify(exclusions) !== JSON.stringify(originalData.exclusions);

  // Track the current fetch request so we can abort stale ones
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track a fetch generation counter to ignore late responses
  const fetchGenerationRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const generation = ++fetchGenerationRef.current;

    try {
      setLoading(true);
      const res = await fetch("/api/settings/profile", { signal: controller.signal });

      // If a newer fetch was started, discard this stale response
      if (generation !== fetchGenerationRef.current) return;

      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();

      // Double-check generation again after async json parsing
      if (generation !== fetchGenerationRef.current) return;

      const p = data.profile;
      setDietaryStyle(p.dietaryStyle || "");
      setAllergies(p.allergies || []);
      setExclusions(p.exclusions || []);
      setOriginalData({
        dietaryStyle: p.dietaryStyle || "",
        allergies: p.allergies || [],
        exclusions: p.exclusions || [],
      });
    } catch (err: unknown) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // If this is a stale generation, ignore
      if (generation !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      // Only update loading state if this is still the current generation
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    // Cleanup: abort any in-flight request when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProfile]);

  const toggleAllergy = (allergy: string) => {
    const lower = allergy.toLowerCase();
    if (allergies.includes(lower)) {
      setAllergies(allergies.filter((a) => a !== lower));
    } else {
      setAllergies([...allergies, lower]);
    }
    setSuccess(false);
  };

  const addExclusion = () => {
    const trimmed = exclusionInput.trim().toLowerCase();
    if (trimmed && !exclusions.includes(trimmed)) {
      setExclusions([...exclusions, trimmed]);
      setExclusionInput("");
    }
    setSuccess(false);
  };

  const removeExclusion = (item: string) => {
    setExclusions(exclusions.filter((e) => e !== item));
    setSuccess(false);
  };

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietaryStyle, allergies, exclusions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setOriginalData({ dietaryStyle, allergies: [...allergies], exclusions: [...exclusions] });
      setSuccess(true);
      toast.success("Dietary preferences saved!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast.error(err instanceof Error ? err.message : "Failed to save dietary preferences");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDietaryStyle(originalData.dietaryStyle as DietaryStyle | "");
    setAllergies([...originalData.allergies]);
    setExclusions([...originalData.exclusions]);
    setSuccess(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <span className="text-sm text-[#a1a1aa]">Loading dietary preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" data-testid="dietary-section">
      <div className="mb-6">
        <h2 className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
          <span className="text-[#f97316]">///</span> Dietary Preferences
        </h2>
        <p className="mt-1 text-sm text-[#71717a]">
          Manage your dietary style, allergies, and exclusions
        </p>
      </div>

      <div className="space-y-5">
        {/* Dietary Style */}
        <div>
          <label id="settings-dietary-style-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Dietary Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {dietaryStyles.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setDietaryStyle(value); setSuccess(false); }}
                data-testid={`settings-diet-${value}`}
                className={`rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors min-h-[44px] ${
                  dietaryStyle === value
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
          <label id="settings-allergies-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Allergies
          </label>
          <div className="flex flex-wrap gap-2">
            {commonAllergies.map((allergy) => (
              <button
                key={allergy}
                onClick={() => toggleAllergy(allergy)}
                className={`rounded-full border px-4 py-2.5 text-xs font-medium transition-colors min-h-[44px] ${
                  allergies.includes(allergy.toLowerCase())
                    ? "border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]"
                    : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
                }`}
              >
                {allergy}
              </button>
            ))}
          </div>
        </div>

        {/* Exclusions */}
        <div>
          <label htmlFor="settings-exclusions" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Food Exclusions
          </label>
          <div className="flex gap-2">
            <input
              id="settings-exclusions"
              type="text"
              value={exclusionInput}
              onChange={(e) => setExclusionInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExclusion()}
              placeholder="e.g., mushrooms, cilantro"
              className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3 text-sm text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none focus:border-[#f97316] min-h-[44px]"
            />
            <button
              onClick={addExclusion}
              className="rounded-lg bg-[#2a2a2a] px-4 py-3 text-sm font-bold text-[#fafafa] hover:bg-[#3a3a3a] min-h-[44px]"
            >
              Add
            </button>
          </div>
          {exclusions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {exclusions.map((item) => (
                <span key={item} className="flex items-center gap-1 rounded-full border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-1 text-xs text-[#a1a1aa]">
                  {item}
                  <button onClick={() => removeExclusion(item)} className="ml-1 text-[#ef4444] hover:text-[#f87171]">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="text-sm text-green-400">Dietary preferences updated!</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-dietary-save"
          className={`rounded-lg px-6 py-3.5 text-sm font-bold uppercase tracking-wide transition-colors min-h-[44px] ${
            dirty && !saving
              ? "bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] cursor-pointer"
              : "bg-[#f97316]/30 text-white/50 cursor-not-allowed"
          }`}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : (
            "Save Changes"
          )}
        </button>
        {dirty && (
          <button onClick={handleReset} className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#252525] transition-colors">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
