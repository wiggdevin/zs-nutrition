"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/lib/toast-store";

type GoalType = "cut" | "maintain" | "bulk";

const goalDescriptions: Record<GoalType, string> = {
  cut: "Lose body fat while preserving muscle",
  maintain: "Stay at your current weight and body composition",
  bulk: "Build muscle with a caloric surplus",
};

export default function SettingsGoals() {
  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [goalRate, setGoalRate] = useState<number>(1);
  const [originalGoalType, setOriginalGoalType] = useState<GoalType | "">("");
  const [originalGoalRate, setOriginalGoalRate] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty = goalType !== originalGoalType || goalRate !== originalGoalRate;

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
      setGoalType(p.goalType || "");
      setGoalRate(typeof p.goalRate === "number" ? p.goalRate : 1);
      setOriginalGoalType(p.goalType || "");
      setOriginalGoalRate(typeof p.goalRate === "number" ? p.goalRate : 1);
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

  const handleGoalSelect = (goal: GoalType) => {
    setGoalType(goal);
    if (goal === "maintain") setGoalRate(0);
    else if (goalRate === 0) setGoalRate(1);
    setSuccess(false);
  };

  async function handleSave() {
    if (!goalType) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType, goalRate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setOriginalGoalType(goalType);
      setOriginalGoalRate(goalRate);
      setSuccess(true);
      toast.success("Goals updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast.error(err instanceof Error ? err.message : "Failed to save goals");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setGoalType(originalGoalType);
    setGoalRate(originalGoalRate);
    setSuccess(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <span className="text-sm text-[#a1a1aa]">Loading goals...</span>
        </div>
      </div>
    );
  }

  const isMaintain = goalType === "maintain";
  const displayRate = isMaintain ? 0 : goalRate;

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" data-testid="goals-section">
      <div className="mb-6">
        <h2 className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
          <span className="text-[#f97316]">///</span> Goals
        </h2>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Set your nutrition goal and target rate
        </p>
      </div>

      <div className="space-y-5">
        {/* Goal Type */}
        <div>
          <label id="settings-goal-type-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Goal Type
          </label>
          <div className="space-y-2">
            {(["cut", "maintain", "bulk"] as GoalType[]).map((goal) => (
              <button
                key={goal}
                onClick={() => handleGoalSelect(goal)}
                data-testid={`settings-goal-${goal}`}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  goalType === goal
                    ? "border-[#f97316] bg-[#f97316]/10"
                    : "border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]"
                }`}
              >
                <span className={`block text-sm font-bold uppercase tracking-wide ${goalType === goal ? "text-[#f97316]" : "text-[#fafafa]"}`}>
                  {goal}
                </span>
                <span className="block text-xs text-[#a1a1aa]">
                  {goalDescriptions[goal]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Goal Rate */}
        {goalType && (
          <div>
            <label htmlFor="settings-goal-rate" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
              {isMaintain
                ? "Rate: N/A (maintaining weight)"
                : `${goalType === "cut" ? "Weight Loss" : "Weight Gain"} Rate: ${displayRate} lbs/week`}
            </label>
            <input
              id="settings-goal-rate"
              type="range"
              value={displayRate}
              onChange={(e) => setGoalRate(parseFloat(e.target.value))}
              min={0}
              max={2}
              step={0.25}
              disabled={isMaintain}
              data-testid="settings-goal-rate"
              className={`w-full accent-[#f97316] ${isMaintain ? "opacity-40 cursor-not-allowed" : ""}`}
            />
            <div className="mt-1 flex justify-between text-xs text-[#a1a1aa]">
              <span>0 lbs/wk</span>
              <span>2 lbs/wk (Aggressive)</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-2" data-testid="goals-save-success">
          <svg className="w-5 h-5 flex-shrink-0 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-green-400">Goals updated successfully!</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-goals-save"
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
