'use client';

const items = [
  'AI-Powered Meal Plans',
  'FatSecret-Verified Data',
  'Real-Time Macro Tracking',
  'Claude Vision Photo Scanning',
  '6-Agent AI Pipeline',
  '7-Day Personalized Plans',
  'QA Validated Nutrition',
  'Adaptive Calorie Targets',
];

export function Marquee() {
  return (
    <div className="relative overflow-hidden border-y border-border bg-card/30 py-4">
      <div className="marquee-track flex">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="mx-6 shrink-0 text-sm font-mono uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap"
          >
            {item}
            <span className="ml-6 text-primary/40">{'///'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
