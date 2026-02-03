"use client";

import { useState } from "react";

/* ── Skeleton Pulse Block ── */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-[#1a1a1a] rounded animate-pulse ${className ?? ""}`} />;
}

/* ── Macro Ring Skeleton ── */
function MacroRingSkeleton({ size = 120 }: { size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-2" data-testid="macro-ring-skeleton">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2a2a2a" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1a1a" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * 0.7} className="animate-pulse" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <SkeletonBlock className="h-5 w-10" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

/* ── Meal Card Skeleton ── */
function MealCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-[#111111] border border-[#2a2a2a] rounded-xl" data-testid="meal-card-skeleton">
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-4 w-40" />
        <div className="flex gap-3 mt-2">
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <SkeletonBlock className="h-4 w-10" />
        <SkeletonBlock className="h-8 w-14 rounded-lg" />
      </div>
    </div>
  );
}

/* ── Log Entry Skeleton ── */
function LogEntrySkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-b-0" data-testid="log-entry-skeleton">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-14 rounded-full" />
        </div>
        <SkeletonBlock className="h-3 w-44" />
      </div>
    </div>
  );
}

/* ── Full Dashboard Skeleton ── */
function DashboardSkeletonDemo() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]" data-testid="dashboard-skeleton">
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#f97316] text-2xl font-heading">///</span>
            <SkeletonBlock className="h-7 w-32" />
          </div>
          <SkeletonBlock className="h-10 w-10 rounded-full" />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
        <section data-testid="macro-rings-skeleton" className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <SkeletonBlock className="h-3 w-24" />
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-6 w-32 rounded-full" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <MacroRingSkeleton size={140} />
            <MacroRingSkeleton />
            <MacroRingSkeleton />
            <MacroRingSkeleton />
          </div>
          <div className="mt-6 flex justify-center">
            <SkeletonBlock className="h-4 w-52" />
          </div>
        </section>
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
          <SkeletonBlock className="h-3 w-32 mb-4" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-12 w-16" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <div className="h-12 w-px bg-[#2a2a2a]" />
            <div className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-8 w-12" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <div className="h-12 w-px bg-[#2a2a2a]" />
            <div className="flex-1 space-y-1">
              <SkeletonBlock className="h-3 w-full rounded-full" />
              <SkeletonBlock className="h-2 w-24" />
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section data-testid="todays-plan-skeleton" className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <div className="space-y-3">
              <MealCardSkeleton />
              <MealCardSkeleton />
              <MealCardSkeleton />
            </div>
          </section>
          <section data-testid="todays-log-skeleton" className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <div>
              <LogEntrySkeleton />
              <LogEntrySkeleton />
              <LogEntrySkeleton />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ── Meal Plan Skeleton ── */
function MealPlanSkeletonDemo() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]" data-testid="meal-plan-skeleton">
      <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-40 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="mt-2 h-7 w-56 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-[#2a2a2a]" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-14 w-20 animate-pulse rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]" />
              <div className="h-14 w-20 animate-pulse rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="meal-plan-skeleton-grid">
          {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => (
            <div key={dayNum} className="min-w-[200px] flex-1">
              <div className="flex flex-col rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden" data-testid={`skeleton-day-${dayNum}`}>
                <div className="border-b border-[#2a2a2a] bg-[#141414] px-3 py-3 text-center">
                  <div className="mx-auto h-4 w-20 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="mx-auto mt-1.5 h-3 w-24 animate-pulse rounded bg-[#2a2a2a]" />
                </div>
                <div className="border-b border-[#2a2a2a] bg-[#111] px-3 py-2">
                  <div className="mx-auto h-4 w-16 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="mt-1 flex justify-center gap-2">
                    <div className="h-3 w-10 animate-pulse rounded bg-[#2a2a2a]" />
                    <div className="h-3 w-10 animate-pulse rounded bg-[#2a2a2a]" />
                    <div className="h-3 w-10 animate-pulse rounded bg-[#2a2a2a]" />
                  </div>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {[1, 2, 3].map((mealNum) => (
                    <div key={mealNum} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-2.5 animate-pulse" data-testid={`skeleton-meal-card-${dayNum}-${mealNum}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="h-4 w-16 rounded bg-[#2a2a2a]" />
                        <div className="h-3 w-14 rounded bg-[#2a2a2a]" />
                      </div>
                      <div className="h-4 w-3/4 rounded bg-[#2a2a2a] mt-1" />
                      <div className="h-3 w-1/2 rounded bg-[#2a2a2a] mt-2" />
                      <div className="mt-2 flex gap-1">
                        <div className="h-5 w-14 rounded-full bg-[#2a2a2a]" />
                        <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
                        <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
                        <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Swap Loading Skeleton ── */
function SwapLoadingDemo() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center">
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#141414] shadow-2xl" data-testid="swap-modal-loading">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa]">Swap Meal</h3>
            <p className="mt-0.5 text-xs text-[#a1a1aa]">Replace <span className="text-[#f97316] font-semibold">Breakfast Burrito</span></p>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#a1a1aa]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="p-5">
          <div className="space-y-3" data-testid="swap-alternatives-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                <div className="h-4 w-2/3 rounded bg-[#2a2a2a]" />
                <div className="mt-2 h-3 w-1/2 rounded bg-[#2a2a2a]" />
                <div className="mt-2 flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-[#2a2a2a]" />
                  <div className="h-5 w-12 rounded-full bg-[#2a2a2a]" />
                  <div className="h-5 w-12 rounded-full bg-[#2a2a2a]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Meal Swap In-Progress Skeleton ── */
function MealSwapInProgressDemo() {
  return (
    <div className="bg-[#0a0a0a] text-[#fafafa] p-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] mb-4">Meal Card During Swap (Skeleton replaces card)</h3>
      <div className="max-w-[250px]">
        <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-2.5 animate-pulse" data-testid="meal-swap-skeleton">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-4 w-16 rounded bg-[#2a2a2a]" />
            <div className="h-3 w-14 rounded bg-[#2a2a2a]" />
          </div>
          <div className="h-4 w-3/4 rounded bg-[#2a2a2a] mt-1" />
          <div className="h-3 w-1/2 rounded bg-[#2a2a2a] mt-2" />
          <div className="mt-2 flex gap-1">
            <div className="h-5 w-14 rounded-full bg-[#2a2a2a]" />
            <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
            <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
            <div className="h-5 w-10 rounded-full bg-[#2a2a2a]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Action Button Loading State ── */
function ActionButtonLoadingDemo() {
  return (
    <div className="bg-[#0a0a0a] text-[#fafafa] p-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] mb-4">Action Button Loading Spinners</h3>
      <div className="flex gap-4 items-center">
        <button disabled className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#f97316]/50 cursor-not-allowed text-[#0a0a0a] rounded-lg flex items-center gap-1.5" data-testid="log-btn-loading">
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Logging</span>
        </button>
        <span className="text-xs text-[#a1a1aa]">Log button (loading)</span>
      </div>
      <div className="flex gap-4 items-center mt-4">
        <button disabled className="flex-1 max-w-[200px] px-4 py-2.5 text-sm font-bold uppercase tracking-wide bg-[#f97316]/50 cursor-not-allowed text-[#0a0a0a] rounded-xl flex items-center justify-center gap-2" data-testid="confirm-log-loading">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Logging...</span>
        </button>
        <span className="text-xs text-[#a1a1aa]">Confirm Log button (loading)</span>
      </div>
      <div className="flex gap-4 items-center mt-4">
        <button disabled className="w-full max-w-[300px] py-3 bg-[#f97316]/50 cursor-not-allowed text-[#0a0a0a] font-semibold rounded-lg flex items-center justify-center gap-2" data-testid="manual-entry-loading">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Logging...</span>
        </button>
        <span className="text-xs text-[#a1a1aa]">Manual Entry submit (loading)</span>
      </div>
    </div>
  );
}

export default function TestLoadingStatesPage() {
  const [view, setView] = useState<"dashboard" | "mealplan" | "swap-modal" | "swap-card" | "buttons">("dashboard");

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Controls */}
      <div className="sticky top-0 z-[100] bg-[#141414] border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-[#a1a1aa] uppercase tracking-wider">Loading State:</span>
          {(["dashboard", "mealplan", "swap-modal", "swap-card", "buttons"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              data-testid={`view-${v}`}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-colors ${
                view === v ? "bg-[#f97316] text-[#0a0a0a]" : "bg-[#2a2a2a] text-[#a1a1aa] hover:bg-[#3a3a3a]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "dashboard" && <DashboardSkeletonDemo />}
      {view === "mealplan" && <MealPlanSkeletonDemo />}
      {view === "swap-modal" && <SwapLoadingDemo />}
      {view === "swap-card" && <MealSwapInProgressDemo />}
      {view === "buttons" && <ActionButtonLoadingDemo />}
    </div>
  );
}
