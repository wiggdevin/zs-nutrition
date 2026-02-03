"use client";

import { useState } from "react";

const agentStages = [
  { number: 1, name: "Intake Normalizer", desc: "Cleaning and validating your data..." },
  { number: 2, name: "Metabolic Calculator", desc: "Calculating BMR, TDEE, and macro targets..." },
  { number: 3, name: "Recipe Curator", desc: "AI generating meal ideas matching your targets..." },
  { number: 4, name: "Nutrition Compiler", desc: "Verifying nutrition data via FatSecret..." },
  { number: 5, name: "QA Validator", desc: "Enforcing calorie and macro tolerances..." },
  { number: 6, name: "Brand Renderer", desc: "Generating your deliverables..." },
];

export default function TestFeature145Page() {
  const [currentAgent, setCurrentAgent] = useState(0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-heading uppercase tracking-wider text-[#fafafa]">
          Feature #145 Test: Animated Progress Indicators
        </h1>

        <div className="mb-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="mb-4 text-xl font-bold text-[#fafafa]">Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCurrentAgent(0)}
              className="rounded-lg bg-[#2a2a2a] px-4 py-2 text-sm font-bold text-[#fafafa] hover:bg-[#3a3a3a]"
            >
              Idle (No Active Agent)
            </button>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => setCurrentAgent(num)}
                className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-bold text-[#0a0a0a] hover:bg-[#ea580c]"
              >
                Agent {num} Active
              </button>
            ))}
            <button
              onClick={() => setCurrentAgent(7)}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-bold text-white hover:bg-[#16a34a]"
            >
              All Complete
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="mb-4 text-xl font-bold text-[#fafafa]">Generation Progress Display</h2>

          <div className="text-center">
            <h1 className="text-3xl font-heading uppercase tracking-wider text-[#fafafa]">
              Generating Plan
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-[#a1a1aa]">
              /// NUTRITION ENGINE ACTIVE
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {agentStages.map((agent) => (
              <div
                key={agent.number}
                className={`rounded-lg border p-4 transition-all duration-500 ${
                  agent.number < currentAgent
                    ? "border-[#22c55e]/30 bg-[#22c55e]/5"
                    : agent.number === currentAgent
                    ? "border-[#f97316]/50 bg-[#f97316]/5"
                    : "border-[#2a2a2a] bg-[#1a1a1a] opacity-40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      agent.number < currentAgent
                        ? "bg-[#22c55e] text-white"
                        : agent.number === currentAgent
                        ? "bg-[#f97316] text-[#0a0a0a]"
                        : "bg-[#2a2a2a] text-[#a1a1aa]"
                    }`}
                  >
                    {agent.number < currentAgent ? "\u2713" : agent.number}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold ${
                        agent.number <= currentAgent
                          ? "text-[#fafafa]"
                          : "text-[#a1a1aa]"
                      }`}
                    >
                      Agent {agent.number}: {agent.name}
                    </p>
                    {agent.number === currentAgent && (
                      <p className="text-xs text-[#a1a1aa]">{agent.desc}</p>
                    )}
                  </div>
                  {agent.number === currentAgent && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <h2 className="mb-4 text-xl font-bold text-[#fafafa]">Verification Checklist</h2>
          <ul className="space-y-2 text-sm text-[#a1a1aa]">
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Active stage has animation (spinner/pulse) - Line 381: animate-spin rounded-full
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Completed stages show checkmark - Line 364: {"\u2713"} when agent.number &lt; currentAgent
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Pending stages show dimmed/inactive state - Line 351: opacity-40
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#22c55e]">✓</span>
              Smooth transitions between stages - Line 346: transition-all duration-500
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
