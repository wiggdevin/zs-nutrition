'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast-store';

export type Sex = 'male' | 'female';

export interface ProfileData {
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

export function useProfileUpdate() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [editName, setEditName] = useState('');
  const [editSex, setEditSex] = useState<Sex | ''>('');
  const [editAge, setEditAge] = useState<string>('');
  const [editHeightCm, setEditHeightCm] = useState<string>('');
  const [editWeightKg, setEditWeightKg] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchGenerationRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const generation = ++fetchGenerationRef.current;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/profile', { signal: controller.signal });

      if (generation !== fetchGenerationRef.current) return;

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load profile');
      }
      const data = await res.json();

      if (generation !== fetchGenerationRef.current) return;

      const p = data.profile;
      setProfile(p);
      setEditName(p.name || '');
      setEditSex(p.sex || '');
      setEditAge(p.age?.toString() || '');
      setEditHeightCm(p.heightCm?.toString() || '');
      setEditWeightKg(p.weightKg?.toString() || '');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (generation !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProfile();
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
      editName !== (profile.name || '') ||
      editSex !== (profile.sex || '') ||
      editAge !== (profile.age?.toString() || '') ||
      editHeightCm !== (profile.heightCm?.toString() || '') ||
      editWeightKg !== (profile.weightKg?.toString() || '');
    setDirty(changed);
    if (changed) {
      setSuccess(false);
    }
  }, [editName, editSex, editAge, editHeightCm, editWeightKg, profile]);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = 'Name is required';
    }
    if (!editSex) {
      errors.sex = 'Please select your biological sex';
    }
    const ageNum = parseInt(editAge);
    if (!editAge || isNaN(ageNum)) {
      errors.age = 'Age is required';
    } else if (ageNum < 18 || ageNum > 100) {
      errors.age = 'Age must be between 18 and 100';
    }
    const heightNum = parseFloat(editHeightCm);
    if (!editHeightCm || isNaN(heightNum)) {
      errors.height = 'Height is required';
    } else if (heightNum < 90 || heightNum > 250) {
      errors.height = 'Height must be between 90 and 250 cm';
    }
    const weightNum = parseFloat(editWeightKg);
    if (!editWeightKg || isNaN(weightNum)) {
      errors.weight = 'Weight is required';
    } else if (weightNum < 35 || weightNum > 230) {
      errors.weight = 'Weight must be between 35 and 230 kg';
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

      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(data.error || 'Failed to save changes');
      }

      const data = await res.json();
      if (data.success && data.profile) {
        setProfile((prev) => (prev ? { ...prev, ...data.profile } : prev));
        setSuccess(true);
        setDirty(false);
        toast.success('Demographics saved successfully!');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!profile) return;
    setEditName(profile.name || '');
    setEditSex(profile.sex || '');
    setEditAge(profile.age?.toString() || '');
    setEditHeightCm(profile.heightCm?.toString() || '');
    setEditWeightKg(profile.weightKg?.toString() || '');
    setValidationErrors({});
    setSuccess(false);
    setError(null);
  }

  return {
    profile,
    loading,
    saving,
    error,
    success,
    editName,
    setEditName,
    editSex,
    setEditSex,
    editAge,
    setEditAge,
    editHeightCm,
    setEditHeightCm,
    editWeightKg,
    setEditWeightKg,
    dirty,
    validationErrors,
    setValidationErrors,
    fetchProfile,
    handleSave,
    handleReset,
  };
}
