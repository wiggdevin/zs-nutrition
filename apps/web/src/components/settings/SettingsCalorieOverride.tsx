'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProfileData {
  goalKcal: number | null;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  sex: string;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}

export default function SettingsCalorieOverride() {
  const utils = trpc.useUtils();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customKcal, setCustomKcal] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          if (data.profile.goalKcal) {
            setCustomKcal(String(data.profile.goalKcal));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const applyMutation = trpc.adaptiveNutrition.applyCalorieAdjustment.useMutation({
    onSuccess: (result) => {
      setShowConfirm(false);
      if (result.planRegenerated) {
        toast.success('Target updated! New plan is being generated.');
      } else {
        toast.success('Target updated! Go to Dashboard to generate a new plan.');
      }
      // Update local state
      if (profile) {
        setProfile({ ...profile, goalKcal: Number(customKcal) });
      }
      // Invalidate daily targets so all pages update
      utils.user.getDailyTargets.invalidate();
    },
    onError: (err) => {
      setShowConfirm(false);
      toast.error(err.message || 'Failed to update calorie target');
    },
  });

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!profile?.bmrKcal) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Complete your profile to see your calorie target. Update your demographics, goals, and
          activity level in the Profile & Preferences section below.
        </p>
      </div>
    );
  }

  const minSafe = Math.max(profile.bmrKcal + 200, profile.sex === 'male' ? 1500 : 1200);
  const maxSafe = profile.bmrKcal + 1500;
  const currentGoal = profile.goalKcal;
  const parsedCustom = Number(customKcal);
  const isValid =
    customKcal !== '' && !isNaN(parsedCustom) && parsedCustom >= minSafe && parsedCustom <= maxSafe;
  const isUnchanged = parsedCustom === currentGoal;
  const canSubmit = isValid && !isUnchanged;

  function handleInputChange(value: string) {
    setCustomKcal(value);
    setError('');
    const num = Number(value);
    if (value && !isNaN(num)) {
      if (num < minSafe || num > maxSafe) {
        setError(
          `Must be between ${minSafe.toLocaleString()} and ${maxSafe.toLocaleString()} kcal`
        );
      }
    }
  }

  function handleConfirm() {
    applyMutation.mutate({
      newGoalKcal: parsedCustom,
      confirmed: true,
    });
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        {/* Current calculated target */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Calculated from your profile</p>
          <p className="text-3xl font-bold tabular-nums">
            {currentGoal?.toLocaleString() ?? '—'}{' '}
            <span className="text-base font-normal text-muted-foreground">kcal/day</span>
          </p>
        </div>

        {/* Macro breakdown */}
        {profile.proteinTargetG && profile.carbsTargetG && profile.fatTargetG && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>P: {Math.round(profile.proteinTargetG)}g</span>
            <span>C: {Math.round(profile.carbsTargetG)}g</span>
            <span>F: {Math.round(profile.fatTargetG)}g</span>
          </div>
        )}

        {/* Custom override input */}
        <div className="space-y-2">
          <label htmlFor="custom-kcal" className="text-sm font-medium text-foreground">
            Custom target
          </label>
          <div className="flex items-center gap-3">
            <input
              id="custom-kcal"
              type="number"
              value={customKcal}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={String(currentGoal ?? '')}
              className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
              min={minSafe}
              max={maxSafe}
            />
            <span className="text-sm text-muted-foreground">kcal/day</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Safe range: {minSafe.toLocaleString()} – {maxSafe.toLocaleString()} kcal
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Submit button */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSubmit || applyMutation.isPending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {applyMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating...
            </span>
          ) : (
            'Update Target & Generate New Plan'
          )}
        </button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Calorie Target Change</AlertDialogTitle>
            <AlertDialogDescription>
              Update your daily calorie target from <strong>{currentGoal?.toLocaleString()}</strong>{' '}
              to <strong>{parsedCustom.toLocaleString()}</strong> kcal? This will recalculate your
              macro targets and trigger a new meal plan generation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm & Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
