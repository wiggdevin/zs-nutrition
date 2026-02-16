'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast-store';

type DietaryStyle = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo';

const dietaryStyles: { value: DietaryStyle; label: string }[] = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

const commonAllergies = [
  'Peanuts',
  'Tree Nuts',
  'Dairy',
  'Eggs',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
  'Sesame',
  'Gluten',
];

const cuisineOptions = [
  'American',
  'Italian',
  'Mexican',
  'Asian',
  'Mediterranean',
  'Indian',
  'Japanese',
  'Thai',
  'Greek',
  'Middle Eastern',
  'Korean',
  'French',
];

export default function SettingsDietary() {
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle | ''>('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [exclusionInput, setExclusionInput] = useState('');
  const [cuisinePrefs, setCuisinePrefs] = useState<string[]>([]);
  const [originalData, setOriginalData] = useState({
    dietaryStyle: '' as string,
    allergies: [] as string[],
    exclusions: [] as string[],
    cuisinePrefs: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty =
    dietaryStyle !== originalData.dietaryStyle ||
    JSON.stringify(allergies) !== JSON.stringify(originalData.allergies) ||
    JSON.stringify(exclusions) !== JSON.stringify(originalData.exclusions) ||
    JSON.stringify(cuisinePrefs) !== JSON.stringify(originalData.cuisinePrefs);

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
      setDietaryStyle(p.dietaryStyle || '');
      setAllergies(p.allergies || []);
      setExclusions(p.exclusions || []);
      setCuisinePrefs(p.cuisinePrefs || []);
      setOriginalData({
        dietaryStyle: p.dietaryStyle || '',
        allergies: p.allergies || [],
        exclusions: p.exclusions || [],
        cuisinePrefs: p.cuisinePrefs || [],
      });
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

  const toggleAllergy = (allergy: string) => {
    const lower = allergy.toLowerCase();
    if (allergies.includes(lower)) {
      setAllergies(allergies.filter((a) => a !== lower));
    } else {
      setAllergies([...allergies, lower]);
    }
    setSuccess(false);
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim().toLowerCase();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      setAllergyInput('');
    }
    setSuccess(false);
  };

  const removeAllergy = (allergy: string) => {
    setAllergies(allergies.filter((a) => a !== allergy));
    setSuccess(false);
  };

  const addExclusion = () => {
    const trimmed = exclusionInput.trim().toLowerCase();
    if (trimmed && !exclusions.includes(trimmed)) {
      setExclusions([...exclusions, trimmed]);
      setExclusionInput('');
    }
    setSuccess(false);
  };

  const removeExclusion = (item: string) => {
    setExclusions(exclusions.filter((e) => e !== item));
    setSuccess(false);
  };

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
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dietaryStyle, allergies, exclusions, cuisinePrefs }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setOriginalData({
        dietaryStyle,
        allergies: [...allergies],
        exclusions: [...exclusions],
        cuisinePrefs: [...cuisinePrefs],
      });
      setSuccess(true);
      toast.success('Dietary preferences saved!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      toast.error(err instanceof Error ? err.message : 'Failed to save dietary preferences');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDietaryStyle(originalData.dietaryStyle as DietaryStyle | '');
    setAllergies([...originalData.allergies]);
    setExclusions([...originalData.exclusions]);
    setCuisinePrefs([...originalData.cuisinePrefs]);
    setSuccess(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading dietary preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6" data-testid="dietary-section">
      <div className="mb-6">
        <h2 className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          <span className="text-primary">{'///'}</span> Dietary Preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your dietary style, allergies, and exclusions
        </p>
      </div>

      <div className="space-y-5">
        {/* Dietary Style */}
        <div>
          <label
            id="settings-dietary-style-label"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Dietary Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {dietaryStyles.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setDietaryStyle(value);
                  setSuccess(false);
                }}
                data-testid={`settings-diet-${value}`}
                className={`rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors min-h-[44px] ${
                  dietaryStyle === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div>
          <label
            id="settings-allergies-label"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Allergies
          </label>

          {/* Common allergy quick-select buttons */}
          <div className="mb-3 flex flex-wrap gap-2">
            {commonAllergies.map((allergy) => (
              <button
                key={allergy}
                onClick={() => toggleAllergy(allergy)}
                className={`rounded-full border px-4 py-2.5 text-xs font-medium transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                  allergies.includes(allergy.toLowerCase())
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
                aria-pressed={allergies.includes(allergy.toLowerCase())}
              >
                {allergy}
              </button>
            ))}
          </div>

          {/* Custom allergy input field */}
          <div className="flex gap-2">
            <input
              id="settings-allergies-custom"
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
              placeholder="Type custom allergy and press Enter"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            />
            <button
              onClick={addAllergy}
              className="rounded-lg bg-border px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Add
            </button>
          </div>

          {/* Allergy chips display */}
          {allergies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {allergies.map((allergy) => (
                <span
                  key={allergy}
                  className="flex items-center gap-1 rounded-full border border-destructive bg-destructive/10 px-3 py-1 text-xs text-destructive"
                >
                  {allergy}
                  <button
                    onClick={() => removeAllergy(allergy)}
                    className="ml-1 hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded"
                    aria-label={`Remove ${allergy}`}
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
          <label
            htmlFor="settings-exclusions"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Food Exclusions
          </label>
          <div className="flex gap-2">
            <input
              id="settings-exclusions"
              type="text"
              value={exclusionInput}
              onChange={(e) => setExclusionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
              placeholder="e.g., mushrooms, cilantro"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary min-h-[44px]"
            />
            <button
              onClick={addExclusion}
              className="rounded-lg bg-border px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary min-h-[44px]"
            >
              Add
            </button>
          </div>
          {exclusions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {exclusions.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
                >
                  {item}
                  <button
                    onClick={() => removeExclusion(item)}
                    className="ml-1 text-destructive hover:text-destructive/80"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cuisine Preferences */}
        <div>
          <label
            id="settings-cuisine-label"
            className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
          >
            Cuisine Preferences (select favorites)
          </label>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="settings-cuisine-label"
          >
            {cuisineOptions.map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                onClick={() => toggleCuisine(cuisine)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCuisine(cuisine);
                  }
                }}
                aria-pressed={cuisinePrefs.includes(cuisine.toLowerCase())}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors min-h-[44px] max-w-[180px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                  cuisinePrefs.includes(cuisine.toLowerCase())
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
                title={cuisine}
              >
                {cuisine}
              </button>
            ))}
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
          <p className="text-sm text-success">Dietary preferences updated!</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="settings-dietary-save"
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
