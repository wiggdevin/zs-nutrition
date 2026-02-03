"use client";

import { useState } from "react";
import { Confetti } from "@/components/ui/Confetti";

export default function TestFeature143Page() {
  const [showConfetti, setShowConfetti] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-lg">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
            /// FEATURE 143 TEST
          </p>
          <h1 className="text-4xl font-heading uppercase tracking-wider text-[#fafafa]">
            Confetti Animation Test
          </h1>
        </div>

        <div className="mt-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
          <p className="text-sm text-[#a1a1aa]">
            Testing Feature #143: Confetti animation on plan generation complete
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded border border-[#2a2a2a] bg-[#1e1e1e] p-4">
              <h3 className="text-sm font-bold text-[#fafafa]">What to test:</h3>
              <ul className="mt-2 space-y-1 text-xs text-[#a1a1aa]">
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
                className="w-full rounded-lg bg-[#f97316] px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition-colors hover:bg-[#ea580c]"
              >
                Trigger Confetti Animation
              </button>
            ) : (
              <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/5 p-4 text-center">
                <p className="text-sm font-bold text-[#22c55e]">
                  ✓ Confetti Animation Playing
                </p>
                <p className="mt-2 text-xs text-[#a1a1aa]">
                  Watch the particles fall from the top of the screen
                </p>
                <button
                  onClick={() => setShowConfetti(false)}
                  className="mt-4 rounded border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-2 text-xs font-bold uppercase text-[#fafafa] hover:bg-[#252525]"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded border border-[#2a2a2a] bg-[#1e1e1e] p-4">
            <h3 className="text-xs font-bold text-[#fafafa]">Verification Steps:</h3>
            <ol className="mt-2 space-y-1 text-xs text-[#a1a1aa] list-decimal list-inside">
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
