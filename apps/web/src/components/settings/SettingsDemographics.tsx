"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/lib/toast-store";

type Sex = "male" | "female";

interface ProfileData {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent: number | null;
  goalType: string;
  goalRate: string;
  activityLevel: string;
  dietaryStyle: string;
}

export default function SettingsDemographics() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editSex, setEditSex] = useState<Sex | "">("");
  const [editAge, setEditAge] = useState<string>("");
  const [editHeightCm, setEditHeightCm] = useState<string>("");
  const [editWeightKg, setEditWeightKg] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
      setError(null);
      const res = await fetch("/api/settings/profile", { signal: controller.signal });

      // If a newer fetch was started, discard this stale response
      if (generation !== fetchGenerationRef.current) return;

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load profile");
      }
      const data = await res.json();

      // Double-check generation again after async json parsing
      if (generation !== fetchGenerationRef.current) return;

      const p = data.profile;
      setProfile(p);
      setEditName(p.name || "");
      setEditSex(p.sex || "");
      setEditAge(p.age?.toString() || "");
      setEditHeightCm(p.heightCm?.toString() || "");
      setEditWeightKg(p.weightKg?.toString() || "");
    } catch (err: unknown) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // If this is a stale generation, ignore
      if (generation !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load profile");
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

  // Track dirty state
  useEffect(() => {
    if (!profile) return;
    const changed =
      editName !== (profile.name || "") ||
      editSex !== (profile.sex || "") ||
      editAge !== (profile.age?.toString() || "") ||
      editHeightCm !== (profile.heightCm?.toString() || "") ||
      editWeightKg !== (profile.weightKg?.toString() || "");
    setDirty(changed);
    // Only clear success when user makes new changes (dirty)
    if (changed) {
      setSuccess(false);
    }
  }, [editName, editSex, editAge, editHeightCm, editWeightKg, profile]);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = "Name is required";
    }
    if (!editSex) {
      errors.sex = "Please select your biological sex";
    }
    const ageNum = parseInt(editAge);
    if (!editAge || isNaN(ageNum)) {
      errors.age = "Age is required";
    } else if (ageNum < 18 || ageNum > 100) {
      errors.age = "Age must be between 18 and 100";
    }
    const heightNum = parseFloat(editHeightCm);
    if (!editHeightCm || isNaN(heightNum)) {
      errors.height = "Height is required";
    } else if (heightNum < 90 || heightNum > 250) {
      errors.height = "Height must be between 90 and 250 cm";
    }
    const weightNum = parseFloat(editWeightKg);
    if (!editWeightKg || isNaN(weightNum)) {
      errors.weight = "Weight is required";
    } else if (weightNum < 35 || weightNum > 230) {
      errors.weight = "Weight must be between 35 and 230 kg";
    }
    return errors;
  }

  async function handleSave() {
    const errs = validate();
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          sex: editSex,
          age: parseInt(editAge),
          heightCm: parseFloat(editHeightCm),
          weightKg: parseFloat(editWeightKg),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save changes");
      }

      const data = await res.json();
      if (data.success && data.profile) {
        setProfile((prev) => (prev ? { ...prev, ...data.profile } : prev));
        setSuccess(true);
        setDirty(false);
        toast.success("Demographics saved successfully!");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!profile) return;
    setEditName(profile.name || "");
    setEditSex(profile.sex || "");
    setEditAge(profile.age?.toString() || "");
    setEditHeightCm(profile.heightCm?.toString() || "");
    setEditWeightKg(profile.weightKg?.toString() || "");
    setValidationErrors({});
    setSuccess(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <span className="text-sm text-[#a1a1aa]">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchProfile}
          className="mt-3 rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-[#a1a1aa] hover:bg-[#252525] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6" data-testid="demographics-section">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa]">
          <span className="text-[#f97316]">///</span> Demographics
        </h2>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Update your basic profile information
        </p>
      </div>

      <div className="space-y-5">
        {/* Name Field */}
        <div>
          <label htmlFor="settings-name" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Name <span className="text-[#f97316]">*</span>
          </label>
          <input
            id="settings-name"
            type="text"
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value)
              if (validationErrors.name && e.target.value.trim()) {
                setValidationErrors((prev) => { const { name: _, ...rest } = prev; return rest })
              }
            }}
            placeholder="Enter your name"
            data-testid="settings-name-input"
            aria-invalid={!!validationErrors.name}
            aria-describedby={validationErrors.name ? "settings-name-error" : undefined}
            className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] ${
              validationErrors.name
                ? "border-red-500 focus:border-red-500"
                : "border-[#2a2a2a] focus:border-[#f97316]"
            }`}
          />
          {validationErrors.name && (
            <p id="settings-name-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
              {validationErrors.name}
            </p>
          )}
        </div>

        {/* Sex Field */}
        <div>
          <label id="settings-sex-label" className="mb-2 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Biological Sex <span className="text-[#f97316]">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="settings-sex-label" aria-invalid={!!validationErrors.sex}>
            {(["male", "female"] as Sex[]).map((sex) => (
              <button
                key={sex}
                onClick={() => {
                  setEditSex(sex)
                  if (validationErrors.sex) {
                    setValidationErrors((prev) => { const { sex: _, ...rest } = prev; return rest })
                  }
                }}
                data-testid={`settings-sex-${sex}`}
                aria-describedby={validationErrors.sex ? "settings-sex-error" : undefined}
                className={`rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                  editSex === sex
                    ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                    : validationErrors.sex
                      ? "border-red-500 bg-[#1e1e1e] text-[#a1a1aa] hover:border-red-400"
                      : "border-[#2a2a2a] bg-[#1e1e1e] text-[#a1a1aa] hover:border-[#3a3a3a]"
                }`}
              >
                {sex}
              </button>
            ))}
          </div>
          {validationErrors.sex && (
            <p id="settings-sex-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
              {validationErrors.sex}
            </p>
          )}
        </div>

        {/* Age Field */}
        <div>
          <label htmlFor="settings-age" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Age <span className="text-[#f97316]">*</span>
          </label>
          <input
            id="settings-age"
            type="number"
            value={editAge}
            onChange={(e) => {
              setEditAge(e.target.value)
              if (validationErrors.age) {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v >= 18 && v <= 100) {
                  setValidationErrors((prev) => { const { age: _, ...rest } = prev; return rest })
                }
              }
            }}
            placeholder="Enter your age"
            min={18}
            max={100}
            data-testid="settings-age-input"
            aria-invalid={!!validationErrors.age}
            aria-describedby={validationErrors.age ? "settings-age-error" : undefined}
            className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] ${
              validationErrors.age
                ? "border-red-500 focus:border-red-500"
                : "border-[#2a2a2a] focus:border-[#f97316]"
            }`}
          />
          {validationErrors.age && (
            <p id="settings-age-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
              {validationErrors.age}
            </p>
          )}
        </div>

        {/* Height Field */}
        <div>
          <label htmlFor="settings-height" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Height (cm) <span className="text-[#f97316]">*</span>
          </label>
          <input
            id="settings-height"
            type="number"
            value={editHeightCm}
            onChange={(e) => {
              setEditHeightCm(e.target.value)
              if (validationErrors.height) {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v >= 90 && v <= 250) {
                  setValidationErrors((prev) => { const { height: _, ...rest } = prev; return rest })
                }
              }
            }}
            placeholder="e.g. 175"
            min={90}
            max={250}
            step="0.1"
            data-testid="settings-height-input"
            aria-invalid={!!validationErrors.height}
            aria-describedby={validationErrors.height ? "settings-height-error" : undefined}
            className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] ${
              validationErrors.height
                ? "border-red-500 focus:border-red-500"
                : "border-[#2a2a2a] focus:border-[#f97316]"
            }`}
          />
          {validationErrors.height && (
            <p id="settings-height-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
              {validationErrors.height}
            </p>
          )}
        </div>

        {/* Weight Field */}
        <div>
          <label htmlFor="settings-weight" className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#a1a1aa]">
            Weight (kg) <span className="text-[#f97316]">*</span>
          </label>
          <input
            id="settings-weight"
            type="number"
            value={editWeightKg}
            onChange={(e) => {
              setEditWeightKg(e.target.value)
              if (validationErrors.weight) {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v >= 35 && v <= 230) {
                  setValidationErrors((prev) => { const { weight: _, ...rest } = prev; return rest })
                }
              }
            }}
            placeholder="e.g. 75"
            min={35}
            max={230}
            step="0.1"
            data-testid="settings-weight-input"
            aria-invalid={!!validationErrors.weight}
            aria-describedby={validationErrors.weight ? "settings-weight-error" : undefined}
            className={`w-full rounded-lg border px-4 py-3 text-[#fafafa] placeholder-[#a1a1aa]/50 outline-none transition-colors bg-[#1e1e1e] ${
              validationErrors.weight
                ? "border-red-500 focus:border-red-500"
                : "border-[#2a2a2a] focus:border-[#f97316]"
            }`}
          />
          {validationErrors.weight && (
            <p id="settings-weight-error" className="mt-1 text-xs text-red-500" role="alert" aria-live="polite">
              {validationErrors.weight}
            </p>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 flex items-center gap-2" data-testid="save-success">
          <svg className="w-5 h-5 flex-shrink-0 text-[#22c55e]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-[#22c55e]">Profile updated successfully!</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-save-btn"
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
          <button
            onClick={handleReset}
            className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-[#a1a1aa] hover:bg-[#252525] transition-colors"
            data-testid="settings-reset-btn"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
