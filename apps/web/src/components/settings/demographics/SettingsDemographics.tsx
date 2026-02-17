'use client';

import { useProfileUpdate } from './useProfileUpdate';
import BasicInfoSection from './BasicInfoSection';
import BodyMetricsSection from './BodyMetricsSection';

export default function SettingsDemographics() {
  const {
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
  } = useProfileUpdate();

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchProfile}
          className="mt-3 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="demographics-section">
      <div className="space-y-5">
        <BasicInfoSection
          editName={editName}
          setEditName={setEditName}
          editSex={editSex}
          setEditSex={setEditSex}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />

        <BodyMetricsSection
          editAge={editAge}
          setEditAge={setEditAge}
          editHeightCm={editHeightCm}
          setEditHeightCm={setEditHeightCm}
          editWeightKg={editWeightKg}
          setEditWeightKg={setEditWeightKg}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div
          className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 flex items-center gap-2"
          data-testid="save-success"
        >
          <svg
            className="w-5 h-5 flex-shrink-0 text-success"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-success">Profile updated successfully!</p>
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
            data-testid="settings-reset-btn"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
