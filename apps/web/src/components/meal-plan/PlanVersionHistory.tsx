'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────

interface PlanVersion {
  id: string;
  version: number;
  generatedAt: string;
  versionedAt: string | null;
  qaScore: number | null;
  qaStatus: string | null;
  dailyKcalTarget: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;
  status: string;
  isActive: boolean;
}

interface MealNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface MealChange {
  slot: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  nameA?: string;
  nameB?: string;
  nutritionA?: MealNutrition;
  nutritionB?: MealNutrition;
}

interface DayDiff {
  dayNumber: number;
  dayName: string;
  kcalDiff: number;
  targetKcalA: number;
  targetKcalB: number;
  meals: MealChange[];
}

interface DiffResponse {
  planA: { id: string; version: number; generatedAt: string };
  planB: { id: string; version: number; generatedAt: string };
  days: DayDiff[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/15 text-green-600 border-green-500/30';
    case 'replaced':
      return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'expired':
      return 'bg-gray-500/15 text-gray-500 border-gray-500/30';
    default:
      return 'bg-gray-500/15 text-gray-500 border-gray-500/30';
  }
}

function qaColor(qaStatus: string | null): string {
  switch (qaStatus) {
    case 'PASS':
      return 'text-green-600';
    case 'WARN':
      return 'text-yellow-600';
    case 'FAIL':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
}

function changeTypeStyle(type: MealChange['type']): string {
  switch (type) {
    case 'added':
      return 'border-l-green-500 bg-green-500/5';
    case 'removed':
      return 'border-l-red-500 bg-red-500/5';
    case 'changed':
      return 'border-l-yellow-500 bg-yellow-500/5';
    default:
      return 'border-l-gray-300 bg-transparent';
  }
}

function changeTypeLabel(type: MealChange['type']): string {
  switch (type) {
    case 'added':
      return 'New';
    case 'removed':
      return 'Removed';
    case 'changed':
      return 'Changed';
    default:
      return 'Same';
  }
}

// ─── Sub-components ──────────────────────────────────────────────────

function MacroDelta({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = b - a;
  if (diff === 0) return null;
  return (
    <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
      {label} {diff > 0 ? '+' : ''}
      {diff}
    </span>
  );
}

function DiffView({ diff, onClose }: { diff: DiffResponse; onClose: () => void }) {
  const changedDays = diff.days.filter((d) => d.meals.some((m) => m.type !== 'unchanged'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          v{diff.planA.version} vs v{diff.planB.version}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {changedDays.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No significant differences between these versions.
        </p>
      )}

      {changedDays.map((day) => (
        <Card key={day.dayNumber} className="overflow-hidden">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{day.dayName}</CardTitle>
              {day.kcalDiff !== 0 && (
                <span
                  className={`text-xs font-bold ${day.kcalDiff > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {day.kcalDiff > 0 ? '+' : ''}
                  {day.kcalDiff} kcal
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-2">
            {day.meals
              .filter((m) => m.type !== 'unchanged')
              .map((meal) => (
                <div
                  key={meal.slot}
                  className={`border-l-4 pl-3 py-2 rounded-r ${changeTypeStyle(meal.type)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {meal.slot
                        .replace(/_\d+$/, '')
                        .replace(/^(\w)(.*)$/, (_, f: string, r: string) => f + r.toLowerCase())}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        meal.type === 'added'
                          ? 'bg-green-500/20 text-green-600'
                          : meal.type === 'removed'
                            ? 'bg-red-500/20 text-red-600'
                            : 'bg-yellow-500/20 text-yellow-600'
                      }`}
                    >
                      {changeTypeLabel(meal.type)}
                    </span>
                  </div>

                  {meal.type === 'changed' && (
                    <div className="mt-1 space-y-0.5">
                      {meal.nameA !== meal.nameB && (
                        <div className="text-xs">
                          <span className="text-red-500 line-through">{meal.nameA}</span>
                          {' -> '}
                          <span className="text-green-600 font-medium">{meal.nameB}</span>
                        </div>
                      )}
                      {meal.nameA === meal.nameB && (
                        <div className="text-xs font-medium text-foreground">{meal.nameA}</div>
                      )}
                      {meal.nutritionA && meal.nutritionB && (
                        <div className="flex gap-3 mt-1">
                          <MacroDelta
                            label="kcal"
                            a={meal.nutritionA.kcal}
                            b={meal.nutritionB.kcal}
                          />
                          <MacroDelta
                            label="P"
                            a={meal.nutritionA.proteinG}
                            b={meal.nutritionB.proteinG}
                          />
                          <MacroDelta
                            label="C"
                            a={meal.nutritionA.carbsG}
                            b={meal.nutritionB.carbsG}
                          />
                          <MacroDelta label="F" a={meal.nutritionA.fatG} b={meal.nutritionB.fatG} />
                        </div>
                      )}
                    </div>
                  )}

                  {meal.type === 'added' && (
                    <div className="mt-1 text-xs font-medium text-green-600">{meal.nameB}</div>
                  )}
                  {meal.type === 'removed' && (
                    <div className="mt-1 text-xs font-medium text-red-500 line-through">
                      {meal.nameA}
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function PlanVersionHistory() {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compare state
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    async function fetchVersions() {
      try {
        const res = await fetch('/api/plan/versions');
        if (!res.ok) throw new Error('Failed to fetch versions');
        const data = await res.json();
        setVersions(data.versions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchVersions();
  }, []);

  const handleCompare = useCallback(async () => {
    if (!compareA || !compareB) return;
    setDiffLoading(true);
    setDiff(null);
    try {
      const res = await fetch(
        `/api/plan/diff?planA=${encodeURIComponent(compareA)}&planB=${encodeURIComponent(compareB)}`
      );
      if (!res.ok) throw new Error('Failed to compute diff');
      const data = await res.json();
      setDiff(data);
    } catch {
      setError('Failed to compare plans');
    } finally {
      setDiffLoading(false);
    }
  }, [compareA, compareB]);

  const toggleSelect = useCallback(
    (id: string) => {
      if (compareA === id) {
        setCompareA(null);
        setDiff(null);
        return;
      }
      if (compareB === id) {
        setCompareB(null);
        setDiff(null);
        return;
      }
      if (!compareA) {
        setCompareA(id);
      } else if (!compareB) {
        setCompareB(id);
      } else {
        // Replace B with new selection
        setCompareB(id);
        setDiff(null);
      }
    },
    [compareA, compareB]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (error && versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No plan versions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with compare action */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Version History</h2>
        {compareA && compareB && (
          <Button size="sm" onClick={handleCompare} disabled={diffLoading}>
            {diffLoading ? 'Comparing...' : 'Compare Selected'}
          </Button>
        )}
      </div>

      {compareA && !compareB && (
        <p className="text-xs text-muted-foreground">Select a second version to compare.</p>
      )}

      {/* Version list */}
      <div className="space-y-2">
        {versions.map((v) => {
          const isSelected = compareA === v.id || compareB === v.id;
          const label = compareA === v.id ? 'A' : compareB === v.id ? 'B' : null;

          return (
            <button
              key={v.id}
              onClick={() => toggleSelect(v.id)}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                isSelected
                  ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                  : 'border-border hover:border-border/80 bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {label && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {label}
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">v{v.version}</span>
                  <span
                    className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(v.status)}`}
                  >
                    {v.status}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(v.versionedAt || v.generatedAt)}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs">
                {v.dailyKcalTarget && (
                  <span className="font-semibold text-foreground">{v.dailyKcalTarget} kcal</span>
                )}
                {v.dailyProteinG && <span className="text-chart-3">P {v.dailyProteinG}g</span>}
                {v.dailyCarbsG && <span className="text-warning">C {v.dailyCarbsG}g</span>}
                {v.dailyFatG && <span className="text-destructive">F {v.dailyFatG}g</span>}
                {v.qaScore !== null && v.qaScore !== undefined && (
                  <span className={`font-semibold ${qaColor(v.qaStatus)}`}>QA: {v.qaScore}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Diff view */}
      {diff && (
        <DiffView
          diff={diff}
          onClose={() => {
            setDiff(null);
            setCompareA(null);
            setCompareB(null);
          }}
        />
      )}

      {error && versions.length > 0 && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
