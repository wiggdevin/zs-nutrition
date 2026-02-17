'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast-store';

type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';
type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const activityLevels: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  {
    value: 'moderately_active',
    label: 'Moderately Active',
    desc: 'Moderate exercise 3-5 days/week',
  },
  { value: 'very_active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'extremely_active', label: 'Extremely Active', desc: 'Athlete or very physical job' },
];

const weekdays: { value: Weekday; label: string }[] = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export default function SettingsActivity() {
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('');
  const [trainingDays, setTrainingDays] = useState<Weekday[]>([]);
  const [cookingSkill, setCookingSkill] = useState(5);
  const [cookingSkillError, setCookingSkillError] = useState<string | null>(null);
  const [prepTimeMax, setPrepTimeMax] = useState(30);
  const [_prepTimeMaxError, setPrepTimeMaxError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState({
    activityLevel: '' as string,
    trainingDays: [] as string[],
    cookingSkill: 5,
    prepTimeMax: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty =
    activityLevel !== originalData.activityLevel ||
    JSON.stringify(trainingDays) !== JSON.stringify(originalData.trainingDays) ||
    cookingSkill !== originalData.cookingSkill ||
    prepTimeMax !== originalData.prepTimeMax;

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
      const res = await fetch('/api/settings/profile', { signal: controller.signal });

      // If a newer fetch was started, discard this stale response
      if (generation !== fetchGenerationRef.current) return;

      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();

      // Double-check generation again after async json parsing
      if (generation !== fetchGenerationRef.current) return;

      const p = data.profile;
      const al = p.activityLevel || '';
      const td = p.trainingDays || [];
      const cs = p.cookingSkill || 5;
      const pt = p.prepTimeMax || 30;
      setActivityLevel(al);
      setTrainingDays(td);
      setCookingSkill(cs);
      setPrepTimeMax(pt);
      setOriginalData({ activityLevel: al, trainingDays: td, cookingSkill: cs, prepTimeMax: pt });
    } catch (err: unknown) {
      // Ignore aborted requests (user navigated away or new fetch started)
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // If this is a stale generation, ignore
      if (generation !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
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

  const toggleTrainingDay = (day: Weekday) => {
    if (trainingDays.includes(day)) {
      setTrainingDays(trainingDays.filter((d) => d !== day));
    } else {
      setTrainingDays([...trainingDays, day]);
    }
    setSuccess(false);
  };

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      setCookingSkillError(null);
      setPrepTimeMaxError(null);

      // Client-side validation for cooking skill
      if (cookingSkill < 1 || cookingSkill > 10) {
        const errorMsg = 'Cooking skill must be between 1 and 10';
        setCookingSkillError(errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        setSaving(false);
        return;
      }

      // Client-side validation for prep time max
      if (prepTimeMax < 10 || prepTimeMax > 120) {
        const errorMsg = 'Prep time must be between 10 and 120 minutes';
        setPrepTimeMaxError(errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        setSaving(false);
        return;
      }

      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityLevel, trainingDays, cookingSkill, prepTimeMax }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setOriginalData({
        activityLevel,
        trainingDays: [...trainingDays],
        cookingSkill,
        prepTimeMax,
      });
      setSuccess(true);
      toast.success('Activity settings saved!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      toast.error(err instanceof Error ? err.message : 'Failed to save activity settings');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setActivityLevel(originalData.activityLevel as ActivityLevel | '');
    setTrainingDays(originalData.trainingDays as Weekday[]);
    setCookingSkill(originalData.cookingSkill);
    setPrepTimeMax(originalData.prepTimeMax);
    setSuccess(false);
    setError(null);
    setCookingSkillError(null);
    setPrepTimeMaxError(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading activity settings...</span>
      </div>
    );
  }

  return (
    <div data-testid="activity-section">
      <div className="space-y-5">
        {/* Activity Level */}
        <div>
          <label
            id="settings-activity-level-label"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Activity Level
          </label>
          <div className="space-y-2">
            {activityLevels.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => {
                  setActivityLevel(value);
                  setSuccess(false);
                }}
                data-testid={`settings-activity-${value}`}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  activityLevel === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <span
                  className={`block text-sm font-bold ${activityLevel === value ? 'text-primary' : 'text-foreground'}`}
                >
                  {label}
                </span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Training Days */}
        <div>
          <label
            id="settings-training-days-label"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Training Days
          </label>
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggleTrainingDay(value)}
                data-testid={`settings-training-${value}`}
                className={`rounded-lg border px-0.5 py-3 text-center text-xs font-bold uppercase transition-colors min-h-[44px] ${
                  trainingDays.includes(value)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cooking Skill */}
        <div>
          <label
            htmlFor="settings-cooking-skill"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Cooking Skill: {cookingSkill}/10
          </label>
          <input
            id="settings-cooking-skill"
            type="range"
            value={cookingSkill}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setCookingSkill(val);
              setSuccess(false);
              // Clear error when value is back in valid range
              if (val >= 1 && val <= 10) {
                setCookingSkillError(null);
              }
            }}
            min={1}
            max={10}
            step={1}
            data-testid="settings-cooking-skill"
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Beginner</span>
            <span>Expert</span>
          </div>
          {cookingSkillError && <p className="mt-1 text-xs text-red-400">{cookingSkillError}</p>}
        </div>

        {/* Prep Time */}
        <div>
          <label
            htmlFor="settings-prep-time"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Max Prep Time: {prepTimeMax} min
          </label>
          <input
            id="settings-prep-time"
            type="range"
            value={prepTimeMax}
            onChange={(e) => {
              setPrepTimeMax(parseInt(e.target.value));
              setSuccess(false);
            }}
            min={10}
            max={120}
            step={5}
            data-testid="settings-prep-time"
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>10 min</span>
            <span>120 min</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
          <p className="text-sm text-success">Activity settings updated!</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-activity-save"
          className={`rounded-lg px-6 py-3.5 text-sm font-bold uppercase tracking-wide transition-colors min-h-[44px] ${
            dirty && !saving
              ? 'bg-primary hover:bg-primary/90 text-background cursor-pointer'
              : 'bg-primary/30 text-white/50 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
        {dirty && (
          <button
            onClick={handleReset}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
