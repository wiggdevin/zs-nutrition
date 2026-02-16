'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const PortionAdjustModal = dynamic(() => import('./PortionAdjustModal'), {
  ssr: false,
});

export interface LogEntryProps {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: number;
  source: 'plan_meal' | 'fatsecret_search' | 'quick_add' | 'manual';
  confidenceScore?: number | null;
  time: string;
  onAdjust: (id: string, newPortion: number) => void;
  isAdjusting: boolean;
}

export const LogEntry = React.memo(function LogEntry({
  id,
  name,
  calories,
  protein,
  carbs,
  fat,
  portion,
  source,
  confidenceScore,
  time,
  onAdjust,
  isAdjusting,
}: LogEntryProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Determine confidence badge based on source and confidenceScore
  // - FatSecret foods are always "Verified" (green)
  // - Plan meals: confidenceScore >= 1.0 = "Verified", < 1.0 = "AI-Estimated"
  // - Quick Add and Manual use their original badges
  const getConfidenceBadge = () => {
    if (source === 'fatsecret_search') {
      return { label: 'Verified', color: 'bg-success/10 text-success' };
    }
    if (source === 'plan_meal') {
      // confidenceScore >= 1.0 means verified, < 1.0 means ai_estimated
      if (confidenceScore !== null && confidenceScore !== undefined && confidenceScore >= 1.0) {
        return { label: 'Verified', color: 'bg-success/10 text-success' };
      }
      return { label: 'AI-Estimated', color: 'bg-warning/10 text-warning' };
    }
    if (source === 'quick_add') {
      return { label: 'Quick Add', color: 'bg-warning/10 text-warning' };
    }
    // manual
    return { label: 'Manual', color: 'bg-muted-foreground/10 text-muted-foreground' };
  };

  const badge = getConfidenceBadge();

  const handleConfirmAdjust = (newPortion: number) => {
    onAdjust(id, newPortion);
    setShowAdjustModal(false);
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground truncate">{name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${badge.color}`}>
              {badge.label}
            </span>
            {portion !== 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-primary/10 text-primary">
                {portion}x
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {time} · {calories} kcal · {protein}g protein
          </p>
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          disabled={isAdjusting}
          aria-label={`Adjust portion for ${name}`}
          className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary border border-border hover:border-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`adjust-btn-${id}`}
        >
          Adjust
        </button>
      </div>

      {showAdjustModal && (
        <PortionAdjustModal
          mealName={name}
          currentPortion={portion}
          calories={calories}
          protein={protein}
          carbs={carbs}
          fat={fat}
          onConfirm={handleConfirmAdjust}
          onCancel={() => setShowAdjustModal(false)}
          isAdjusting={isAdjusting}
        />
      )}
    </>
  );
});
