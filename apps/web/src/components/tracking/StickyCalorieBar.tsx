'use client';

import { useState } from 'react';
import { useTrackingStore } from '@/lib/stores/useTrackingStore';

function MacroRow({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target && target > 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-destructive' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-20 text-right tabular-nums ${over ? 'text-destructive' : 'text-foreground'}`}
      >
        {parseFloat(current.toFixed(0))}g / {target}g
      </span>
    </div>
  );
}

export function StickyCalorieBar() {
  const [expanded, setExpanded] = useState(false);
  const current = useTrackingStore((s) => s.current);
  const targets = useTrackingStore((s) => s.targets);

  const calPct =
    targets.calories > 0 ? Math.min((current.calories / targets.calories) * 100, 100) : 0;
  const overBudget = current.calories > targets.calories && targets.calories > 0;

  return (
    <div className="fixed left-0 right-0 bottom-16 z-40 md:hidden">
      <div className="mx-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Collapsed bar — always visible */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${parseFloat(current.calories.toFixed(0))} of ${targets.calories} calories. Tap to ${expanded ? 'collapse' : 'expand'} macro details.`}
          className="w-full flex items-center gap-3 px-4 py-2.5"
        >
          {/* Progress bar */}
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${calPct}%` }}
            />
          </div>

          {/* Calorie text */}
          <span
            className={`text-xs font-bold tabular-nums whitespace-nowrap ${overBudget ? 'text-destructive' : 'text-foreground'}`}
          >
            {parseFloat(current.calories.toFixed(0)).toLocaleString()} /{' '}
            {targets.calories.toLocaleString()} kcal
          </span>

          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Expanded macro breakdown */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-3 space-y-2 border-t border-border pt-2">
              <MacroRow
                label="Protein"
                current={current.protein}
                target={targets.protein}
                color="bg-chart-3"
              />
              <MacroRow
                label="Carbs"
                current={current.carbs}
                target={targets.carbs}
                color="bg-success"
              />
              <MacroRow label="Fat" current={current.fat} target={targets.fat} color="bg-warning" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
