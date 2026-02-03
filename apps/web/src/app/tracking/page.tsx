'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import NavBar from '@/components/navigation/NavBar'
import FoodSearch from '@/components/tracking/FoodSearch'
import ManualEntryForm from '@/components/tracking/ManualEntryForm'
import QuickAddForm from '@/components/tracking/QuickAddForm'
import FoodScan from '@/components/tracking/FoodScan'
import { useTrackingStore } from '@/lib/stores/useTrackingStore'
import Link from 'next/link'

export default function TrackingPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') // 'plan', 'search', 'quick', or null (show all)
  const foodSearchRef = useRef<HTMLDivElement>(null)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const manualEntryRef = useRef<HTMLDivElement>(null)

  // Read from Zustand store (same state as dashboard)
  const targets = useTrackingStore((state) => state.targets)
  const current = useTrackingStore((state) => state.current)
  const trackedMeals = useTrackingStore((state) => state.trackedMeals)
  const isLoading = useTrackingStore((state) => state.isLoading)
  const planId = useTrackingStore((state) => state.planId)

  // Scroll to and focus the relevant section based on mode
  useEffect(() => {
    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      if (mode === 'search' && foodSearchRef.current) {
        foodSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Focus the first input in the food search section
        const input = foodSearchRef.current.querySelector('input') as HTMLInputElement
        if (input) input.focus()
      } else if (mode === 'quick' && quickAddRef.current) {
        quickAddRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Focus the first input in the quick add section
        const input = quickAddRef.current.querySelector('input') as HTMLInputElement
        if (input) input.focus()
      } else if (mode === 'manual' && manualEntryRef.current) {
        manualEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Focus the first input in the manual entry section
        const input = manualEntryRef.current.querySelector('input') as HTMLInputElement
        if (input) input.focus()
      } else if (mode === 'plan') {
        // For plan mode, redirect to meal plan page if they have a plan
        // Otherwise, show food search with a message
        if (!planId && foodSearchRef.current) {
          foodSearchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [mode, planId])

  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-heading uppercase tracking-wider mb-2">Tracking</h1>
            <p className="text-[#a1a1aa] mb-6">Search and log foods to track your daily macros.</p>

            {/* Daily Totals - shows same data as dashboard (from Zustand) */}
            <div
              data-testid="tracking-daily-totals"
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-6"
            >
              <p className="text-xs font-mono tracking-wider uppercase text-[#a1a1aa] mb-3">
                /// Daily Totals
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                  <span className="text-sm text-[#a1a1aa]">Calories</span>
                  <span data-testid="tracking-calories" className="text-sm font-bold text-[#fafafa] ml-auto">
                    {current.calories} / {targets.calories}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                  <span className="text-sm text-[#a1a1aa]">Protein</span>
                  <span data-testid="tracking-protein" className="text-sm font-bold text-[#fafafa] ml-auto">
                    {current.protein}g / {targets.protein}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-sm text-[#a1a1aa]">Carbs</span>
                  <span data-testid="tracking-carbs" className="text-sm font-bold text-[#fafafa] ml-auto">
                    {current.carbs}g / {targets.carbs}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                  <span className="text-sm text-[#a1a1aa]">Fat</span>
                  <span data-testid="tracking-fat" className="text-sm font-bold text-[#fafafa] ml-auto">
                    {current.fat}g / {targets.fat}g
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#2a2a2a] text-center">
                <p className="text-xs text-[#a1a1aa]">
                  {trackedMeals.length} item{trackedMeals.length !== 1 ? 's' : ''} logged today
                </p>
              </div>
            </div>

            {/* Mode-specific message */}
            {mode === 'plan' && !planId && (
              <div className="bg-[#f97316]/10 border border-[#f97316]/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-[#f97316] font-semibold mb-1">No Active Meal Plan</p>
                <p className="text-xs text-[#a1a1aa] mb-3">
                  Generate a meal plan to log meals from your plan, or use the options below.
                </p>
                <Link
                  href="/meal-plan"
                  className="inline-block px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] text-xs font-bold uppercase tracking-wide rounded-lg transition-colors"
                >
                  View Meal Plan
                </Link>
              </div>
            )}

            {/* AI-Powered Food Scan - always shown */}
            <FoodScan onMealLogged={() => {
              // Refresh tracking data when meal is logged
              window.location.reload()
            }} />

            {/* Food Search - shown when mode is null, 'search', or 'plan' (if no planId) */}
            {!mode || mode === 'search' || (mode === 'plan' && !planId) ? (
              <div ref={mode === 'search' || (mode === 'plan' && !planId) ? foodSearchRef : null}>
                <FoodSearch />
              </div>
            ) : null}

            {/* Quick Add - shown when mode is null, 'quick', or 'plan' (if no planId) */}
            {!mode || mode === 'quick' || (mode === 'plan' && !planId) ? (
              <div ref={mode === 'quick' || (mode === 'plan' && !planId) ? quickAddRef : null}>
                <QuickAddForm />
              </div>
            ) : null}

            {/* Manual Entry - shown when mode is null or 'manual' */}
            {!mode || mode === 'manual' ? (
              <div ref={mode === 'manual' ? manualEntryRef : null} className="mt-4">
                <ManualEntryForm />
              </div>
            ) : null}

            {/* Show all sections backlink when in specific mode */}
            {mode && (
              <div className="mt-8 pt-6 border-t border-[#2a2a2a] text-center">
                <Link
                  href="/tracking"
                  className="inline-flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-[#f97316] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
