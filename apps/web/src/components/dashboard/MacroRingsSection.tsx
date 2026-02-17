'use client';

import { useEffect, useState } from 'react';
import { MacroRing } from './MacroRing';
import type { MacroData, RemainingBudget } from './useDashboardComputations';

interface MacroRingsSectionProps {
  macros: MacroData;
  remaining: RemainingBudget;
  isOverCalories: boolean;
  isOverProtein: boolean;
  isTrainingDay: boolean;
  trainingBonusKcal: number;
}

export function MacroRingsSection({
  macros,
  remaining,
  isOverCalories,
  isOverProtein,
  isTrainingDay,
  trainingBonusKcal,
}: MacroRingsSectionProps) {
  const [ringSize, setRingSize] = useState(120);

  useEffect(() => {
    const update = () => setRingSize(window.innerWidth < 640 ? 90 : 120);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <section
      data-testid="macro-rings-section"
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          {'/// Macro Rings'}
        </p>
        <div className="flex items-center gap-3">
          {isTrainingDay ? (
            <span
              data-testid="training-day-badge"
              className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary border border-primary/30"
            >
              Training Day +{trainingBonusKcal} kcal
            </span>
          ) : (
            <span
              data-testid="rest-day-badge"
              className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full bg-chart-3/15 text-chart-3 border border-chart-3/30"
            >
              Rest Day
            </span>
          )}
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 md:gap-8 justify-items-center">
        <MacroRing
          label="Calories"
          current={macros.calories.current}
          target={macros.calories.target}
          unit="kcal"
          color="var(--primary)"
          size={ringSize}
        />
        <MacroRing
          label="Protein"
          current={macros.protein.current}
          target={macros.protein.target}
          unit="g"
          color="var(--chart-3)"
          size={ringSize}
        />
        <MacroRing
          label="Carbs"
          current={macros.carbs.current}
          target={macros.carbs.target}
          unit="g"
          color="var(--color-warning)"
          size={ringSize}
        />
        <MacroRing
          label="Fat"
          current={macros.fat.current}
          target={macros.fat.target}
          unit="g"
          color="var(--destructive)"
          size={ringSize}
        />
      </div>

      {/* Remaining Budget */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          {isOverProtein ? (
            <span className="text-destructive font-semibold">
              {parseFloat(Math.abs(remaining.protein).toFixed(1))}g protein over
            </span>
          ) : (
            <span className="text-chart-3 font-semibold">
              {parseFloat(remaining.protein.toFixed(1))}g protein
            </span>
          )}{' '}
          ·{' '}
          {isOverCalories ? (
            <span className="text-destructive font-semibold">
              {parseFloat(Math.abs(remaining.calories).toFixed(1))} kcal over
            </span>
          ) : (
            <span className="text-primary font-semibold">
              {parseFloat(remaining.calories.toFixed(1))} kcal
            </span>
          )}{' '}
          {isOverCalories || isOverProtein ? '' : 'remaining'}
        </p>
      </div>
    </section>
  );
}
