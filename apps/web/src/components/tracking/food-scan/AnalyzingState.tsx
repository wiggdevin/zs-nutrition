import { Loader2 } from 'lucide-react';

interface AnalyzingStateProps {
  imageData: string | null;
}

export function AnalyzingState({ imageData }: AnalyzingStateProps) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-6 mb-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center py-8">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" aria-hidden="true" />
        <h3 className="text-lg font-heading uppercase tracking-wider mb-2">Analyzing Your Meal</h3>
        <p className="text-sm text-muted-foreground text-center">
          Claude Vision is identifying ingredients and estimating nutrition...
        </p>
      </div>

      {imageData && (
        <div className="mt-4 rounded-lg overflow-hidden border border-border">
          <img src={imageData} alt="Captured meal" className="w-full h-48 object-cover" />
        </div>
      )}
    </div>
  );
}
