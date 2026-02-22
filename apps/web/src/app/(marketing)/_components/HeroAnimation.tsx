'use client';

import { useEffect, useState } from 'react';

const macros = [
  { label: 'Cal', current: 1847, target: 2200, color: 'var(--primary)' },
  { label: 'Protein', current: 142, target: 165, color: 'var(--chart-2)' },
  { label: 'Carbs', current: 198, target: 248, color: 'var(--chart-3)' },
  { label: 'Fat', current: 58, target: 73, color: 'var(--chart-4)' },
];

const pills = [
  { text: 'FatSecret Verified', colorClass: 'border-chart-2/30 bg-chart-2/10 text-chart-2' },
  { text: 'QA Validated', colorClass: 'border-chart-3/30 bg-chart-3/10 text-chart-3' },
  { text: 'On Track', colorClass: 'border-primary/30 bg-primary/10 text-primary' },
];

export function HeroAnimation() {
  const [mounted, setMounted] = useState(false);
  const [activeDay, setActiveDay] = useState(3);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveDay((prev) => (prev % 7) + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: '400ms' }}
    >
      <div className="relative rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-sm hero-glow">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <p className="section-label text-muted-foreground">{'/// DAILY OVERVIEW'}</p>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-mono text-primary">
            Day {activeDay} of 7
          </span>
        </div>

        {/* Macro rings */}
        <div className="grid grid-cols-4 gap-3">
          {macros.map((macro) => {
            const size = 72;
            const strokeWidth = 5;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const progress = macro.current / macro.target;
            const dashOffset = circumference * (1 - progress);
            return (
              <div key={macro.label} className="flex flex-col items-center gap-1">
                <div className="relative" style={{ width: size, height: size }}>
                  <svg width={size} height={size} className="-rotate-90">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth={strokeWidth}
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={macro.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold font-mono" style={{ color: macro.color }}>
                      {macro.current}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {macro.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Floating pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {pills.map((pill, i) => (
            <span
              key={pill.text}
              className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-wider ${pill.colorClass}`}
              style={{ animation: `float 3s ease-in-out ${i * 0.5}s infinite` }}
            >
              {pill.text}
            </span>
          ))}
        </div>

        {/* Day selector */}
        <div className="mt-5 flex gap-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <button
              key={`${day}-${i}`}
              onClick={() => setActiveDay(i + 1)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-mono font-bold transition-all duration-300 ${
                i + 1 <= activeDay
                  ? i + 1 === activeDay
                    ? 'bg-primary text-background scale-110 shadow-lg shadow-primary/25'
                    : 'bg-primary/80 text-background'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/30'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
