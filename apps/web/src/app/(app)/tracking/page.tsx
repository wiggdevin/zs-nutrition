'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavBar from '@/components/navigation/NavBar';
import FoodSearch from '@/components/tracking/FoodSearch';
import ManualEntryForm from '@/components/tracking/ManualEntryForm';
import { TrackingMethodTabs } from '@/components/tracking/TrackingMethodTabs';
import { StickyCalorieBar } from '@/components/tracking/StickyCalorieBar';

import nextDynamic from 'next/dynamic';

const FoodScan = nextDynamic(() => import('@/components/tracking/FoodScan'), {
  loading: () => (
    <div className="relative mb-8">
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 rounded-t-xl"
        aria-hidden="true"
      />
      <div className="h-64 animate-pulse bg-muted rounded-xl" />
    </div>
  ),
});
import { useTrackingStore } from '@/lib/stores/useTrackingStore';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function TrackingPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // 'plan', 'search', 'quick', 'manual', 'scan', or null
  const foodScanRef = useRef<HTMLDivElement>(null);
  const foodSearchRef = useRef<HTMLDivElement>(null);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'search' | 'manual'>(() => {
    if (mode === 'quick' || mode === 'manual') return 'manual';
    return 'search';
  });

  // Read from Zustand store (same state as dashboard)
  const trackedMeals = useTrackingStore((state) => state.trackedMeals);
  const planId = useTrackingStore((state) => state.planId);

  // Sync activeTab from URL params
  useEffect(() => {
    if (mode === 'search') setActiveTab('search');
    else if (mode === 'quick' || mode === 'manual') setActiveTab('manual');
  }, [mode]);

  // Scroll to and focus the relevant section based on mode
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'scan' && foodScanRef.current) {
        foodScanRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (mode === 'search' && foodSearchRef.current) {
        foodSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = foodSearchRef.current.querySelector('input') as HTMLInputElement;
        if (input) input.focus();
      } else if ((mode === 'quick' || mode === 'manual') && manualEntryRef.current) {
        manualEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = manualEntryRef.current.querySelector('input') as HTMLInputElement;
        if (input) input.focus();
      } else if (mode === 'plan') {
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
      <div className="md:pt-14 pb-36 md:pb-14">
        <PageHeader
          title="Tracking"
          showPrefix
          sticky
          maxWidth="screen-2xl"
          subtitle="Search and log foods to track your daily macros."
        />
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Hero: AI-Powered Food Scan */}
            <div ref={foodScanRef} className="relative mb-8">
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 rounded-t-xl"
                aria-hidden="true"
              />
              <FoodScan
                onMealLogged={() => {
                  window.location.reload();
                }}
              />
            </div>

            {/* Compact daily summary */}
            <p
              data-testid="tracking-daily-totals"
              className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-6"
            >
              {'/// Today'} &mdash; {trackedMeals.length} item{trackedMeals.length !== 1 ? 's' : ''}{' '}
              logged
            </p>

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

            {/* Secondary methods */}
            <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground mb-3">
              {'/// Other Ways to Log'}
            </p>
            <TrackingMethodTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab panels */}
            {activeTab === 'search' && (
              <div ref={foodSearchRef} role="tabpanel" id="tabpanel-search" aria-label="Search">
                <FoodSearch />
              </div>
            )}

            {activeTab === 'manual' && (
              <div
                ref={manualEntryRef}
                role="tabpanel"
                id="tabpanel-manual"
                aria-label="Manual Entry"
              >
                <ManualEntryForm />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky calorie bar — mobile only */}
      <StickyCalorieBar />
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
