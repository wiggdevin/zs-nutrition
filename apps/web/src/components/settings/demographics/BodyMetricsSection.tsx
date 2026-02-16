'use client';

interface BodyMetricsSectionProps {
  editAge: string;
  setEditAge: (v: string) => void;
  editHeightCm: string;
  setEditHeightCm: (v: string) => void;
  editWeightKg: string;
  setEditWeightKg: (v: string) => void;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function BodyMetricsSection({
  editAge,
  setEditAge,
  editHeightCm,
  setEditHeightCm,
  editWeightKg,
  setEditWeightKg,
  validationErrors,
  setValidationErrors,
}: BodyMetricsSectionProps) {
  return (
    <>
      {/* Age Field */}
      <div>
        <label
          htmlFor="settings-age"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Age <span className="text-primary">*</span>
        </label>
        <input
          id="settings-age"
          type="number"
          value={editAge}
          onChange={(e) => {
            setEditAge(e.target.value);
            if (validationErrors.age) {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 18 && v <= 100) {
                setValidationErrors((prev) => {
                  const { age: _, ...rest } = prev;
                  return rest;
                });
              }
            }
          }}
          placeholder="Enter your age"
          min={18}
          max={100}
          data-testid="settings-age-input"
          aria-invalid={!!validationErrors.age}
          aria-describedby={validationErrors.age ? 'settings-age-error' : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-foreground placeholder-muted-foreground/50 outline-none transition-colors bg-card ${
            validationErrors.age
              ? 'border-red-500 focus:border-red-500'
              : 'border-border focus:border-primary'
          }`}
        />
        {validationErrors.age && (
          <p
            id="settings-age-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.age}
          </p>
        )}
      </div>

      {/* Height Field */}
      <div>
        <label
          htmlFor="settings-height"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Height (cm) <span className="text-primary">*</span>
        </label>
        <input
          id="settings-height"
          type="number"
          value={editHeightCm}
          onChange={(e) => {
            setEditHeightCm(e.target.value);
            if (validationErrors.height) {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 90 && v <= 250) {
                setValidationErrors((prev) => {
                  const { height: _, ...rest } = prev;
                  return rest;
                });
              }
            }
          }}
          placeholder="e.g. 175"
          min={90}
          max={250}
          step="0.1"
          data-testid="settings-height-input"
          aria-invalid={!!validationErrors.height}
          aria-describedby={validationErrors.height ? 'settings-height-error' : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-foreground placeholder-muted-foreground/50 outline-none transition-colors bg-card ${
            validationErrors.height
              ? 'border-red-500 focus:border-red-500'
              : 'border-border focus:border-primary'
          }`}
        />
        {validationErrors.height && (
          <p
            id="settings-height-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.height}
          </p>
        )}
      </div>

      {/* Weight Field */}
      <div>
        <label
          htmlFor="settings-weight"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          Weight (kg) <span className="text-primary">*</span>
        </label>
        <input
          id="settings-weight"
          type="number"
          value={editWeightKg}
          onChange={(e) => {
            setEditWeightKg(e.target.value);
            if (validationErrors.weight) {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 35 && v <= 230) {
                setValidationErrors((prev) => {
                  const { weight: _, ...rest } = prev;
                  return rest;
                });
              }
            }
          }}
          placeholder="e.g. 75"
          min={35}
          max={230}
          step="0.1"
          data-testid="settings-weight-input"
          aria-invalid={!!validationErrors.weight}
          aria-describedby={validationErrors.weight ? 'settings-weight-error' : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-foreground placeholder-muted-foreground/50 outline-none transition-colors bg-card ${
            validationErrors.weight
              ? 'border-red-500 focus:border-red-500'
              : 'border-border focus:border-primary'
          }`}
        />
        {validationErrors.weight && (
          <p
            id="settings-weight-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
            aria-live="polite"
          >
            {validationErrors.weight}
          </p>
        )}
      </div>
    </>
  );
}
