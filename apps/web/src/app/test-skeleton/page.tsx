"use client"

import { useState } from 'react'

export default function TestSkeletonPage() {
  const [loading, setLoading] = useState(true)

  // Toggle loading state every 3 seconds for testing
  useState(() => {
    const interval = setInterval(() => {
      setLoading(prev => !prev)
    }, 3000)
    return () => clearInterval(interval)
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa] mb-2">
            Skeleton Loader Test
          </h1>
          <p className="text-[#a1a1aa]">
            Dark theme skeleton shimmer animation test
          </p>
          <button
            onClick={() => setLoading(!loading)}
            className="mt-4 px-4 py-2 bg-[#f97316] text-[#0a0a0a] rounded-lg font-semibold"
          >
            Toggle Loading (currently: {loading ? 'ON' : 'OFF'})
          </button>
        </div>

        {/* Test 1: Basic skeleton blocks */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#a1a1aa] mb-4">
            /// Basic Skeleton Blocks
          </h2>
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded skeleton-shimmer" />
              <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              <div className="h-12 w-full rounded skeleton-shimmer" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[#fafafa]">This is actual content that appears after loading.</p>
              <p className="text-[#a1a1aa]">The skeleton blocks should have a subtle shimmer animation.</p>
              <div className="h-12 w-full bg-[#2a2a2a] rounded flex items-center justify-center">
                <span className="text-[#a1a1aa]">Content area</span>
              </div>
            </div>
          )}
        </section>

        {/* Test 2: Card skeletons (like meal cards) */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#a1a1aa] mb-4">
            /// Card Skeletons (Meal Card Style)
          </h2>
          <div className="space-y-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-16 rounded skeleton-shimmer" />
                      <div className="h-3 w-14 rounded skeleton-shimmer" />
                    </div>
                    <div className="h-4 w-3/4 rounded skeleton-shimmer mb-2" />
                    <div className="h-3 w-1/2 rounded skeleton-shimmer mb-3" />
                    <div className="flex gap-2">
                      <div className="h-6 w-14 rounded-full skeleton-shimmer" />
                      <div className="h-6 w-12 rounded-full skeleton-shimmer" />
                      <div className="h-6 w-12 rounded-full skeleton-shimmer" />
                      <div className="h-6 w-12 rounded-full skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#f97316]/20 text-[#f97316] rounded">BREAKFAST</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-[#22c55e]/20 text-[#22c55e] rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-[#fafafa]">Greek Yogurt Parfait with Berries</p>
                  <p className="text-xs text-[#a1a1aa] mt-1">🕒 10m prep</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f97316]/15 text-[#f97316] rounded-full">320 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] rounded-full">P 18g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b] rounded-full">C 42g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ef4444]/15 text-[#ef4444] rounded-full">F 8g</span>
                  </div>
                </div>
                <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#f97316]/20 text-[#f97316] rounded">LUNCH</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-[#22c55e]/20 text-[#22c55e] rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-[#fafafa]">Grilled Chicken Salad with Quinoa</p>
                  <p className="text-xs text-[#a1a1aa] mt-1">🕒 15m prep + 20m cook</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f97316]/15 text-[#f97316] rounded-full">450 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] rounded-full">P 38g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b] rounded-full">C 35g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ef4444]/15 text-[#ef4444] rounded-full">F 18g</span>
                  </div>
                </div>
                <div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#f97316]/20 text-[#f97316] rounded">DINNER</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-[#22c55e]/20 text-[#22c55e] rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-[#fafafa]">Salmon with Roasted Vegetables</p>
                  <p className="text-xs text-[#a1a1aa] mt-1">🕒 10m prep + 25m cook</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f97316]/15 text-[#f97316] rounded-full">520 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] rounded-full">P 42g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b] rounded-full">C 28g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#ef4444]/15 text-[#ef4444] rounded-full">F 22g</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Test 3: Comparison - Shimmer vs Pulse */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#a1a1aa] mb-4">
            /// Animation Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#a1a1aa] mb-2">Shimmer (NEW):</p>
              <div className="h-20 rounded skeleton-shimmer" />
            </div>
            <div>
              <p className="text-xs text-[#a1a1aa] mb-2">Pulse (OLD):</p>
              <div className="h-20 rounded bg-[#1a1a1a] animate-pulse" />
            </div>
          </div>
        </section>

        {/* Test 4: Color variants */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#a1a1aa] mb-4">
            /// Color Variants (Dark Theme)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#a1a1aa] mb-2">Background (#1a1a1a):</p>
              <div className="h-16 rounded bg-[#1a1a1a] border border-[#2a2a2a]" />
            </div>
            <div>
              <p className="text-xs text-[#a1a1aa] mb-2">Card Background (#0f0f0f):</p>
              <div className="h-16 rounded bg-[#0f0f0f] border border-[#2a2a2a]" />
            </div>
            <div>
              <p className="text-xs text-[#a1a1aa] mb-2">Border (#2a2a2a):</p>
              <div className="h-16 rounded bg-[#1a1a1a] border-2 border-[#2a2a2a]" />
            </div>
          </div>
        </section>

        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#a1a1aa] mb-4">
            /// Verification Checklist
          </h2>
          <ul className="space-y-2 text-sm text-[#a1a1aa]">
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Skeleton color is slightly lighter than background
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Shimmer animation moves left to right
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Animation is smooth and subtle (2s duration)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Skeleton shapes match content layout
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Smooth transition to real content
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
