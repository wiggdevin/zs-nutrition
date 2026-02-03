'use client'

import { useState, useEffect } from 'react'
import NavBar from '@/components/navigation/NavBar'
import FoodSearch from '@/components/tracking/FoodSearch'
import ManualEntryForm from '@/components/tracking/ManualEntryForm'
import QuickAddForm from '@/components/tracking/QuickAddForm'
import { useTrackingStore } from '@/lib/stores/useTrackingStore'

export default function TrackingPage() {
  // Read from Zustand store (same state as dashboard)
  const targets = useTrackingStore((state) => state.targets)
  const current = useTrackingStore((state) => state.current)
  const trackedMeals = useTrackingStore((state) => state.trackedMeals)
  const isLoading = useTrackingStore((state) => state.isLoading)

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

            <FoodSearch />
            <QuickAddForm />
            <div className="mt-4">
              <ManualEntryForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
