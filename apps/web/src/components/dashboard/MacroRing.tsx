'use client';

import React, { useState, useEffect } from 'react';

export interface MacroRingProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
  size?: number;
}

export const MacroRing = React.memo(function MacroRing({
  label,
  current,
  target,
  unit,
  color,
  size = 120,
}: MacroRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / (target || 1), 1);
  const targetDashOffset = circumference * (1 - progress);
  const percentage = Math.round(progress * 100);

  // Animate from 0 on mount, then animate to new values on updates
  const [dashOffset, setDashOffset] = useState(circumference); // Start empty (full offset)
  const [animatedCurrent, setAnimatedCurrent] = useState(0);

  useEffect(() => {
    // Animate to new values with smooth timing
    const timer = setTimeout(() => {
      setDashOffset(targetDashOffset);
      setAnimatedCurrent(current);
    }, 50); // Small delay to ensure transition triggers

    return () => clearTimeout(timer);
  }, [current, targetDashOffset]);

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="progressbar"
      aria-label={`${label}`}
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuetext={`${label}: ${current} of ${target} ${unit}, ${percentage}% complete`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500 ease-out"
            style={{
              transitionProperty: 'stroke-dashoffset',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold font-mono transition-all duration-500 ease-out"
            style={{ color }}
          >
            {parseFloat(animatedCurrent.toFixed(1))}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            / {target}
            {unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  );
});
