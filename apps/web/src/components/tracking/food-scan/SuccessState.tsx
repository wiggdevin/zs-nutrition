import { Check } from 'lucide-react';

export function SuccessState() {
  return (
    <div
      className="bg-card border border-success/30 rounded-xl p-6 mb-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center"
          aria-hidden="true"
        >
          <Check className="w-6 h-6 text-success" />
        </div>
        <div>
          <h3 className="text-lg font-heading uppercase tracking-wider text-success">
            Meal Logged!
          </h3>
          <p className="text-sm text-muted-foreground">
            Your meal has been added to today&apos;s tracking
          </p>
        </div>
      </div>
    </div>
  );
}
