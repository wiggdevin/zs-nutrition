'use client';

import { useState } from 'react';
import type { Meal, SwapTarget } from './types';

interface SwapMealModalProps {
  target: SwapTarget;
  alternatives: Meal[];
  loading: boolean;
  onSelect: (alt: Meal) => void;
  onClose: () => void;
}

export function SwapMealModal({
  target,
  alternatives,
  loading,
  onSelect,
  onClose,
}: SwapMealModalProps) {
  const [selecting, setSelecting] = useState(false);

  const handleSelect = (alt: Meal) => {
    if (selecting) return;
    setSelecting(true);
    onSelect(alt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="swap-modal"
    >
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-border card-elevation-modal">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Swap Meal
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Replace <span className="text-primary font-semibold">{target.meal.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            data-testid="swap-modal-close"
            aria-label="Close swap modal"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L13 13M1 13L13 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3" data-testid="swap-alternatives-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border card-elevation p-4">
                  <div className="h-4 w-2/3 rounded skeleton-shimmer" />
                  <div className="mt-2 h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="mt-2 flex gap-2">
                    <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                    <div className="h-5 w-12 rounded-full skeleton-shimmer" />
                    <div className="h-5 w-12 rounded-full skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : alternatives.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No alternatives available for this meal slot.
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="swap-alternatives-list">
              {alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(alt)}
                  disabled={selecting}
                  className={`w-full rounded-lg border border-border card-elevation p-4 text-left transition-all ${
                    selecting ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'
                  }`}
                  data-testid={`swap-alternative-${idx}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-sm font-semibold text-foreground truncate"
                        title={alt.name}
                      >
                        {alt.name}
                      </h4>
                      {alt.cuisine && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{alt.cuisine}</p>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {alt.prepTimeMin ? `${alt.prepTimeMin}m prep` : ''}
                        {alt.prepTimeMin && alt.cookTimeMin ? ' + ' : ''}
                        {alt.cookTimeMin ? `${alt.cookTimeMin}m cook` : ''}
                      </div>
                    </div>
                    <span className="ml-2 rounded bg-primary/20 px-2 py-1 text-[10px] font-bold text-primary">
                      SELECT
                    </span>
                  </div>
                  {/* Macro pills */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {alt.nutrition.kcal} kcal
                    </span>
                    <span className="inline-flex items-center rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-bold text-chart-3">
                      P {alt.nutrition.proteinG}g
                    </span>
                    <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                      C {alt.nutrition.carbsG}g
                    </span>
                    <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                      F {alt.nutrition.fatG}g
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
