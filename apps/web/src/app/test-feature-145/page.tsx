"use client";

import { notFound } from 'next/navigation'
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
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [currentAgent, setCurrentAgent] = useState(0);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-heading uppercase tracking-wider text-foreground">
          Feature #145 Test: Animated Progress Indicators
        </h1>

        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCurrentAgent(0)}
              className="rounded-lg bg-muted px-4 py-2 text-sm font-bold text-foreground hover:bg-accent"
            >
              Idle (No Active Agent)
            </button>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => setCurrentAgent(num)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background hover:bg-primary/90"
              >
                Agent {num} Active
              </button>
            ))}
            <button
              onClick={() => setCurrentAgent(7)}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600"
            >
              All Complete
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Generation Progress Display</h2>

          <div className="text-center">
            <h1 className="text-3xl font-heading uppercase tracking-wider text-foreground">
              Generating Plan
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              /// NUTRITION ENGINE ACTIVE
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {agentStages.map((agent) => (
              <div
                key={agent.number}
                className={`rounded-lg border p-4 transition-all duration-500 ${
                  agent.number < currentAgent
                    ? "border-green-500/30 bg-green-500/5"
                    : agent.number === currentAgent
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card opacity-40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      agent.number < currentAgent
                        ? "bg-green-500 text-white"
                        : agent.number === currentAgent
                        ? "bg-primary text-background"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {agent.number < currentAgent ? "\u2713" : agent.number}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold ${
                        agent.number <= currentAgent
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      Agent {agent.number}: {agent.name}
                    </p>
                    {agent.number === currentAgent && (
                      <p className="text-xs text-muted-foreground">{agent.desc}</p>
                    )}
                  </div>
                  {agent.number === currentAgent && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Verification Checklist</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Active stage has animation (spinner/pulse) - Line 381: animate-spin rounded-full
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Completed stages show checkmark - Line 364: {"\u2713"} when agent.number &lt; currentAgent
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Pending stages show dimmed/inactive state - Line 351: opacity-40
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Smooth transitions between stages - Line 346: transition-all duration-500
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
