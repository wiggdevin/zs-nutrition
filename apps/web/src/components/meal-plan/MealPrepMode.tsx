'use client';

import { useMemo } from 'react';
import type { PlanDay } from './types';
import {
  groupByProtein,
  buildPrepTimeline,
  consolidateIngredients,
  type PrepGroup,
  type PrepStep,
  type ConsolidatedIngredient,
} from './prep-utils';

interface MealPrepModeProps {
  days: PlanDay[];
}

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function MealPrepMode({ days }: MealPrepModeProps) {
  const groups = useMemo(() => groupByProtein(days), [days]);
  const timeline = useMemo(() => buildPrepTimeline(groups), [groups]);
  const allMeals = useMemo(() => days.flatMap((d) => d.meals), [days]);
  const consolidated = useMemo(() => consolidateIngredients(allMeals), [allMeals]);

  const totalTime = useMemo(
    () => timeline.reduce((sum, s) => sum + (s.parallel ? 0 : s.duration), 0),
    [timeline]
  );

  // Consolidated ingredients per protein group
  const groupIngredients = useMemo(() => {
    const result = new Map<string, ConsolidatedIngredient[]>();
    for (const group of groups) {
      const mealsInGroup = days.flatMap((d) =>
        d.meals.filter((m) =>
          group.meals.some(
            (gm) => gm.dayNumber === d.dayNumber && gm.slot === m.slot && gm.name === m.name
          )
        )
      );
      result.set(group.protein, consolidateIngredients(mealsInGroup));
    }
    return result;
  }, [groups, days]);

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No meals to organize for prep.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-8" data-testid="meal-prep-mode">
      {/* Total Time Banner */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Estimated Total Prep Time
            </p>
            <p className="mt-1 text-3xl font-black text-primary">{formatDuration(totalTime)}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{groups.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Protein Groups
              </p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{allMeals.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Meals
              </p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{consolidated.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Ingredients
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Prep Groups Section */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">
          Protein Groups
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <PrepGroupCard
              key={group.protein}
              group={group}
              ingredients={groupIngredients.get(group.protein) ?? []}
            />
          ))}
        </div>
      </section>

      {/* Timeline Section */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">
          Prep Timeline
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {timeline.map((step) => (
              <TimelineStep key={step.step} step={step} />
            ))}
          </div>
        </div>
      </section>

      {/* Consolidated Ingredients Section */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">
          All Ingredients (Consolidated)
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {consolidated.map((ing, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-secondary"
              >
                <span className="text-sm text-foreground">{ing.name}</span>
                <span className="ml-3 flex-shrink-0 whitespace-nowrap rounded bg-border px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
                  {ing.totalAmount > 0
                    ? `${Number.isInteger(ing.totalAmount) ? ing.totalAmount : ing.totalAmount.toFixed(1)} ${ing.unit}`.trim()
                    : ing.unit || 'as needed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// --- Sub-components ---

function PrepGroupCard({
  group,
  ingredients,
}: {
  group: PrepGroup;
  ingredients: ConsolidatedIngredient[];
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden"
      data-testid={`prep-group-${group.protein.toLowerCase()}`}
    >
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">{group.protein}</h3>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
            {group.totalServings} {group.totalServings === 1 ? 'serving' : 'servings'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDuration(group.estimatedPrepMin)} prep</span>
          <span className="text-border">|</span>
          <span>{formatDuration(group.estimatedCookMin)} cook</span>
        </div>
      </div>

      {/* Meal list */}
      <div className="px-5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Meals
        </p>
        <div className="space-y-1.5">
          {group.meals.map((meal, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary border border-primary/20">
                {DAY_NAMES[meal.dayNumber] || `D${meal.dayNumber}`}
              </span>
              <span className="text-muted-foreground text-xs">{meal.slot}</span>
              <span className="text-foreground text-xs font-medium truncate">{meal.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top ingredients for this group */}
      {ingredients.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Key Ingredients
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ingredients.slice(0, 6).map((ing, i) => (
              <span
                key={i}
                className="rounded-full bg-border px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {ing.name}
                {ing.totalAmount > 0
                  ? ` (${Number.isInteger(ing.totalAmount) ? ing.totalAmount : ing.totalAmount.toFixed(1)} ${ing.unit})`.trim()
                  : ''}
              </span>
            ))}
            {ingredients.length > 6 && (
              <span className="rounded-full bg-border px-2 py-0.5 text-[11px] text-muted-foreground">
                +{ingredients.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineStep({ step }: { step: PrepStep }) {
  const typeStyles = {
    prep: 'bg-chart-3/15 text-chart-3 border-chart-3/20',
    cook: 'bg-warning/15 text-warning border-warning/20',
    rest: 'bg-primary/15 text-primary border-primary/20',
  };

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 ${step.parallel ? 'bg-secondary/30' : ''}`}
      data-testid={`prep-step-${step.step}`}
    >
      {/* Step number */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-sm font-bold text-foreground">
        {step.step}
      </div>

      {/* Action */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{step.action}</p>
        {step.parallel && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">Can overlap with adjacent step</p>
        )}
      </div>

      {/* Type badge */}
      <span
        className={`flex-shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeStyles[step.type]}`}
      >
        {step.type}
      </span>

      {/* Duration */}
      <span className="flex-shrink-0 font-mono text-sm font-bold text-muted-foreground">
        {formatDuration(step.duration)}
      </span>
    </div>
  );
}
