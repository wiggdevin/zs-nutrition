'use client';

const prompts = [
  {
    label: 'Review My Day',
    message: 'How am I doing today with my macros? Any suggestions for the rest of the day?',
  },
  {
    label: 'Meal Suggestions',
    message: 'What should I eat for my next meal based on my remaining macros?',
  },
  { label: 'Explain My Plan', message: 'Can you explain my current meal plan and daily targets?' },
  { label: 'Protein Tips', message: 'What are some easy ways to hit my protein target?' },
  { label: 'Weight Trend', message: 'How is my weight trending? Am I on track for my goal?' },
  {
    label: 'Recovery Meal',
    message: "What's a good post-workout recovery meal that fits my macros?",
  },
];

interface QuickPromptsProps {
  onSelect: (message: string) => void;
}

export function QuickPrompts({ onSelect }: QuickPromptsProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1">
        {'/// Nutrition Coach'}
      </p>
      <h2 className="text-xl font-heading uppercase tracking-wider text-foreground mb-6">
        How can I help?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        {prompts.map((p) => (
          <button
            key={p.label}
            onClick={() => onSelect(p.message)}
            className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
