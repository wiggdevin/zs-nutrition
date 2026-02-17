'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavBar from '@/components/navigation/NavBar';
import FoodSearch from '@/components/tracking/FoodSearch';
import ManualEntryForm from '@/components/tracking/ManualEntryForm';

import nextDynamic from 'next/dynamic';

const FoodScan = nextDynamic(() => import('@/components/tracking/FoodScan'), {
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});
import { useTrackingStore } from '@/lib/stores/useTrackingStore';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function TrackingPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // 'plan', 'search', 'quick', or null (show all)
  const foodSearchRef = useRef<HTMLDivElement>(null);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  // Read from Zustand store (same state as dashboard)
  const targets = useTrackingStore((state) => state.targets);
  const current = useTrackingStore((state) => state.current);
  const trackedMeals = useTrackingStore((state) => state.trackedMeals);
  const _isLoading = useTrackingStore((state) => state.isLoading);
  const planId = useTrackingStore((state) => state.planId);

  // Scroll to and focus the relevant section based on mode
  useEffect(() => {
    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      if (mode === 'search' && foodSearchRef.current) {
        foodSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus the first input in the food search section
        const input = foodSearchRef.current.querySelector('input') as HTMLInputElement;
        if (input) input.focus();
      } else if ((mode === 'quick' || mode === 'manual') && manualEntryRef.current) {
        manualEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus the first input in the manual entry section
        const input = manualEntryRef.current.querySelector('input') as HTMLInputElement;
        if (input) input.focus();
      } else if (mode === 'plan') {
        // For plan mode, redirect to meal plan page if they have a plan
        // Otherwise, show food search with a message
        if (!planId && foodSearchRef.current) {
          foodSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [mode, planId]);

  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <PageHeader
          title="Tracking"
          showPrefix
          sticky
          maxWidth="screen-2xl"
          subtitle="Search and log foods to track your daily macros."
        />
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Daily Totals - shows same data as dashboard (from Zustand) */}
            <div
              data-testid="tracking-daily-totals"
              className="bg-card border border-border rounded-xl p-4 mb-6"
            >
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
                {'/// Daily Totals'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Calories</span>
                  <span
                    data-testid="tracking-calories"
                    className="text-sm font-bold text-foreground ml-auto"
                  >
                    {parseFloat(current.calories.toFixed(1))} / {targets.calories}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-chart-3" />
                  <span className="text-sm text-muted-foreground">Protein</span>
                  <span
                    data-testid="tracking-protein"
                    className="text-sm font-bold text-foreground ml-auto"
                  >
                    {parseFloat(current.protein.toFixed(1))}g / {targets.protein}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Carbs</span>
                  <span
                    data-testid="tracking-carbs"
                    className="text-sm font-bold text-foreground ml-auto"
                  >
                    {parseFloat(current.carbs.toFixed(1))}g / {targets.carbs}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Fat</span>
                  <span
                    data-testid="tracking-fat"
                    className="text-sm font-bold text-foreground ml-auto"
                  >
                    {parseFloat(current.fat.toFixed(1))}g / {targets.fat}g
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  {trackedMeals.length} item{trackedMeals.length !== 1 ? 's' : ''} logged today
                </p>
              </div>
            </div>

            {/* Mode-specific message */}
            {mode === 'plan' && !planId && (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-primary font-semibold mb-1">No Active Meal Plan</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate a meal plan to log meals from your plan, or use the options below.
                </p>
                <Link
                  href="/meal-plan"
                  className="inline-block px-4 py-2 bg-primary hover:bg-primary/90 text-background text-xs font-bold uppercase tracking-wide rounded-lg transition-colors"
                >
                  View Meal Plan
                </Link>
              </div>
            )}

            {/* AI-Powered Food Scan - always shown */}
            <FoodScan
              onMealLogged={() => {
                // Refresh tracking data when meal is logged
                window.location.reload();
              }}
            />

            {/* Food Search - shown when mode is null, 'search', or 'plan' (if no planId) */}
            {!mode || mode === 'search' || (mode === 'plan' && !planId) ? (
              <div ref={mode === 'search' || (mode === 'plan' && !planId) ? foodSearchRef : null}>
                <FoodSearch />
              </div>
            ) : null}

            {/* Custom Food Entry - shown when mode is null, 'quick', 'manual', or 'plan' (if no planId) */}
            {!mode || mode === 'quick' || mode === 'manual' || (mode === 'plan' && !planId) ? (
              <div
                ref={
                  mode === 'quick' || mode === 'manual' || (mode === 'plan' && !planId)
                    ? manualEntryRef
                    : null
                }
                className="mt-4"
              >
                <ManualEntryForm />
              </div>
            ) : null}

            {/* Show all sections backlink when in specific mode */}
            {mode && (
              <div className="mt-8 pt-6 border-t border-border text-center">
                <Link
                  href="/tracking"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Show all logging options
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function TrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <TrackingPageContent />
    </Suspense>
  );
}
