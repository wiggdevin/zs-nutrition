"use client"

import { notFound } from 'next/navigation'
import { useState } from 'react'

export default function TestSkeletonPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [loading, setLoading] = useState(true)

  // Toggle loading state every 3 seconds for testing
  useState(() => {
    const interval = setInterval(() => {
      setLoading(prev => !prev)
    }, 3000)
    return () => clearInterval(interval)
  })

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading uppercase tracking-wider text-foreground mb-2">
            Skeleton Loader Test
          </h1>
          <p className="text-muted-foreground">
            Dark theme skeleton shimmer animation test
          </p>
          <button
            onClick={() => setLoading(!loading)}
            className="mt-4 px-4 py-2 bg-primary text-background rounded-lg font-semibold"
          >
            Toggle Loading (currently: {loading ? 'ON' : 'OFF'})
          </button>
        </div>

        {/* Test 1: Basic skeleton blocks */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
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
              <p className="text-foreground">This is actual content that appears after loading.</p>
              <p className="text-muted-foreground">The skeleton blocks should have a subtle shimmer animation.</p>
              <div className="h-12 w-full bg-muted rounded flex items-center justify-center">
                <span className="text-muted-foreground">Content area</span>
              </div>
            </div>
          )}
        </section>

        {/* Test 2: Card skeletons (like meal cards) */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            /// Card Skeletons (Meal Card Style)
          </h2>
          <div className="space-y-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-background p-4"
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
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/20 text-primary rounded">BREAKFAST</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-green-500/20 text-green-500 rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Greek Yogurt Parfait with Berries</p>
                  <p className="text-xs text-muted-foreground mt-1">🕒 10m prep</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">320 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-500 rounded-full">P 18g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-500 rounded-full">C 42g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-500 rounded-full">F 8g</span>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/20 text-primary rounded">LUNCH</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-green-500/20 text-green-500 rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Grilled Chicken Salad with Quinoa</p>
                  <p className="text-xs text-muted-foreground mt-1">🕒 15m prep + 20m cook</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">450 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-500 rounded-full">P 38g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-500 rounded-full">C 35g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-500 rounded-full">F 18g</span>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/20 text-primary rounded">DINNER</span>
                    <span className="px-2 py-0.5 text-[8px] font-semibold uppercase bg-green-500/20 text-green-500 rounded">✓ Verified</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Salmon with Roasted Vegetables</p>
                  <p className="text-xs text-muted-foreground mt-1">🕒 10m prep + 25m cook</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">520 kcal</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-500 rounded-full">P 42g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-500 rounded-full">C 28g</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-500 rounded-full">F 22g</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Test 3: Comparison - Shimmer vs Pulse */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            /// Animation Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Shimmer (NEW):</p>
              <div className="h-20 rounded skeleton-shimmer" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Pulse (OLD):</p>
              <div className="h-20 rounded bg-card animate-pulse" />
            </div>
          </div>
        </section>

        {/* Test 4: Color variants */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            /// Color Variants (Dark Theme)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Background (#1a1a1a):</p>
              <div className="h-16 rounded bg-card border border-border" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Card Background (#0f0f0f):</p>
              <div className="h-16 rounded bg-background border border-border" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Border (#2a2a2a):</p>
              <div className="h-16 rounded bg-card border-2 border-border" />
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            /// Verification Checklist
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Skeleton color is slightly lighter than background
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Shimmer animation moves left to right
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Animation is smooth and subtle (2s duration)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Skeleton shapes match content layout
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Smooth transition to real content
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
