"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/lib/toast-store";

type MacroStyle = "balanced" | "high_protein" | "low_carb" | "keto";

const macroStyles: { value: MacroStyle; label: string; desc: string }[] = [
  { value: "balanced", label: "Balanced", desc: "30P / 40C / 30F — General health" },
  { value: "high_protein", label: "High Protein", desc: "40P / 35C / 25F — Muscle building" },
  { value: "low_carb", label: "Low Carb", desc: "35P / 25C / 40F — Fat adaptation" },
  { value: "keto", label: "Keto", desc: "30P / 5C / 65F — Ketogenic" },
];

const cuisineOptions = [
  "American", "Italian", "Mexican", "Asian", "Mediterranean",
  "Indian", "Japanese", "Thai", "Greek", "Middle Eastern", "Korean", "French",
];

export default function SettingsMealStructure() {
  const [macroStyle, setMacroStyle] = useState<MacroStyle | "">("");
  const [cuisinePrefs, setCuisinePrefs] = useState<string[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [snacksPerDay, setSnacksPerDay] = useState(1);
  const [originalData, setOriginalData] = useState({
    macroStyle: "" as string,
    cuisinePrefs: [] as string[],
    mealsPerDay: 3,
    snacksPerDay: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const dirty =
    macroStyle !== originalData.macroStyle ||
    JSON.stringify(cuisinePrefs) !== JSON.stringify(originalData.cuisinePrefs) ||
    mealsPerDay !== originalData.mealsPerDay ||
    snacksPerDay !== originalData.snacksPerDay;

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
      const ms = p.macroStyle || "";
      const cp = p.cuisinePrefs || [];
      const mpd = p.mealsPerDay || 3;
      const spd = p.snacksPerDay ?? 1;
      setMacroStyle(ms);
      setCuisinePrefs(cp);
      setMealsPerDay(mpd);
      setSnacksPerDay(spd);
      setOriginalData({ macroStyle: ms, cuisinePrefs: cp, mealsPerDay: mpd, snacksPerDay: spd });
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

  const toggleCuisine = (cuisine: string) => {
    const lower = cuisine.toLowerCase();
    if (cuisinePrefs.includes(lower)) {
      setCuisinePrefs(cuisinePrefs.filter((c) => c !== lower));
    } else {
      setCuisinePrefs([...cuisinePrefs, lower]);
    }
    setSuccess(false);
  };

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      setValidationError(null);

      // Client-side validation
      if (mealsPerDay < 2 || mealsPerDay > 6) {
        const errorMsg = "Meals per day must be between 2 and 6";
        setValidationError(errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ macroStyle, cuisinePrefs, mealsPerDay, snacksPerDay }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setOriginalData({
        macroStyle,
        cuisinePrefs: [...cuisinePrefs],
        mealsPerDay,
        snacksPerDay,
      });
      setSuccess(true);
      toast.success("Meal structure saved!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast.error(err instanceof Error ? err.message : "Failed to save meal structure");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setMacroStyle(originalData.macroStyle as MacroStyle | "");
    setCuisinePrefs([...originalData.cuisinePrefs]);
    setMealsPerDay(originalData.mealsPerDay);
    setSnacksPerDay(originalData.snacksPerDay);
    setSuccess(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <span className="text-sm text-[#a1a1aa]">Loading meal structure...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" data-testid="meal-structure-section">
      <div className="mb-6">
        <h2 className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
          <span className="text-[#f97316]">///</span> Meal Structure
        </h2>
        <p className="mt-1 text-sm text-[#71717a]">
          Configure your macro split, cuisine preferences, and meal frequency
        </p>
      </div>

      <div className="space-y-5">
        {/* Macro Style */}
        <div>
          <label id="settings-macro-split-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Macro Split
          </label>
          <div className="space-y-2">
            {macroStyles.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => { setMacroStyle(value); setSuccess(false); }}
                data-testid={`settings-macro-${value}`}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  macroStyle === value
                    ? "border-[#f97316] bg-[#f97316]/10"
                    : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]"
                }`}
              >
                <span className={`block text-sm font-bold ${macroStyle === value ? "text-[#f97316]" : "text-[#fafafa]"}`}>
                  {label}
                </span>
                <span className="block text-xs text-[#a1a1aa]">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cuisine Preferences */}
        <div>
          <label id="settings-cuisine-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Cuisine Preferences
          </label>
          <div className="flex flex-wrap gap-2">
            {cuisineOptions.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => toggleCuisine(cuisine)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                  cuisinePrefs.includes(cuisine.toLowerCase())
                    ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                    : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
                }`}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </div>

        {/* Meals & Snacks */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-meals-per-day" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
              Meals/Day: {mealsPerDay}
            </label>
            <input
              id="settings-meals-per-day"
              type="range"
              value={mealsPerDay}
              onChange={(e) => { setMealsPerDay(parseInt(e.target.value)); setSuccess(false); }}
              min={2}
              max={6}
              step={1}
              data-testid="settings-meals-per-day"
              className="w-full accent-[#f97316]"
            />
            <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
              <span>2</span>
              <span>6</span>
            </div>
          </div>
          <div>
            <label htmlFor="settings-snacks-per-day" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
              Snacks/Day: {snacksPerDay}
            </label>
            <input
              id="settings-snacks-per-day"
              type="range"
              value={snacksPerDay}
              onChange={(e) => { setSnacksPerDay(parseInt(e.target.value)); setSuccess(false); }}
              min={0}
              max={4}
              step={1}
              data-testid="settings-snacks-per-day"
              className="w-full accent-[#f97316]"
            />
            <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
              <span>0</span>
              <span>4</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="text-sm text-green-400">Meal structure updated!</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-meal-save"
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
