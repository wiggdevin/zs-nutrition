"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";
import { Confetti } from "@/components/ui/Confetti";

export default function TestFeature143Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [showConfetti, setShowConfetti] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            /// FEATURE 143 TEST
          </p>
          <h1 className="text-4xl font-heading uppercase tracking-wider text-foreground">
            Confetti Animation Test
          </h1>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-8 shadow-xl">
          <p className="text-sm text-muted-foreground">
            Testing Feature #143: Confetti animation on plan generation complete
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground">What to test:</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>✓ Confetti particles fall from top of screen</li>
                <li>✓ Particles use brand colors (orange, green, blue, etc.)</li>
                <li>✓ Animation lasts for 2 seconds</li>
                <li>✓ Particles rotate as they fall</li>
                <li>✓ Doesn't block user interaction</li>
              </ul>
            </div>

            {!showConfetti ? (
              <button
                onClick={() => setShowConfetti(true)}
                className="w-full rounded-lg bg-primary px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
              >
                Trigger Confetti Animation
              </button>
            ) : (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
                <p className="text-sm font-bold text-green-500">
                  ✓ Confetti Animation Playing
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Watch the particles fall from the top of the screen
                </p>
                <button
                  onClick={() => setShowConfetti(false)}
                  className="mt-4 rounded border border-border bg-card px-4 py-2 text-xs font-bold uppercase text-foreground hover:bg-muted"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded border border-border bg-card p-4">
            <h3 className="text-xs font-bold text-foreground">Verification Steps:</h3>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              <li>Click "Trigger Confetti Animation" button</li>
              <li>Observe particles falling from top of screen</li>
              <li>Verify particles use brand colors</li>
              <li>Verify animation duration (~2 seconds)</li>
              <li>Verify you can still interact with page</li>
              <li>Click "Reset" and try again</li>
            </ol>
          </div>
        </div>

        {showConfetti && <Confetti duration={2000} particleCount={60} />}
      </div>
    </div>
  );
}
