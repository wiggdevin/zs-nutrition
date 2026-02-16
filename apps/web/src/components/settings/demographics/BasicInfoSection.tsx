'use client';

import type { Sex } from './useProfileUpdate';

interface BasicInfoSectionProps {
  editName: string;
  setEditName: (v: string) => void;
  editSex: Sex | '';
  setEditSex: (v: Sex | '') => void;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function BasicInfoSection({
  editName,
  setEditName,
  editSex,
  setEditSex,
  validationErrors,
  setValidationErrors,
}: BasicInfoSectionProps) {
  return (
    <>
      {/* Name Field */}
      <div>
        <label
          htmlFor="settings-name"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Name <span className="text-primary">*</span>
        </label>
        <input
          id="settings-name"
          type="text"
          value={editName}
          onChange={(e) => {
            setEditName(e.target.value);
            if (validationErrors.name && e.target.value.trim()) {
              setValidationErrors((prev) => {
                const { name: _, ...rest } = prev;
                return rest;
              });
            }
          }}
          placeholder="Enter your name"
          data-testid="settings-name-input"
          aria-invalid={!!validationErrors.name}
          aria-describedby={validationErrors.name ? 'settings-name-error' : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-foreground placeholder-muted-foreground/50 outline-none transition-colors bg-card ${
            validationErrors.name
              ? 'border-red-500 focus:border-red-500'
              : 'border-border focus:border-primary'
          }`}
        />
        {validationErrors.name && (
          <p
            id="settings-name-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.name}
          </p>
        )}
      </div>

      {/* Sex Field */}
      <div>
        <label
          id="settings-sex-label"
          className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Biological Sex <span className="text-primary">*</span>
        </label>
        <div
          className="grid grid-cols-2 gap-3"
          role="group"
          aria-labelledby="settings-sex-label"
          aria-invalid={!!validationErrors.sex}
        >
          {(['male', 'female'] as Sex[]).map((sex) => (
            <button
              key={sex}
              onClick={() => {
                setEditSex(sex);
                if (validationErrors.sex) {
                  setValidationErrors((prev) => {
                    const { sex: _, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              data-testid={`settings-sex-${sex}`}
              aria-describedby={validationErrors.sex ? 'settings-sex-error' : undefined}
              className={`rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                editSex === sex
                  ? 'border-primary bg-primary/10 text-primary'
                  : validationErrors.sex
                    ? 'border-red-500 bg-card text-muted-foreground hover:border-red-400'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
              }`}
            >
              {sex}
            </button>
          ))}
        </div>
        {validationErrors.sex && (
          <p
            id="settings-sex-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.sex}
          </p>
        )}
      </div>
    </>
  );
}
