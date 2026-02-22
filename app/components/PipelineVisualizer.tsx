'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const agents = [
  {
    number: 1,
    name: 'Intake Normalizer',
    shortDesc: 'Cleans & validates input',
    desc: 'Parses your goals, dietary restrictions, and preferences into a structured profile the pipeline can process.',
  },
  {
    number: 2,
    name: 'Metabolic Calculator',
    shortDesc: 'Computes your targets',
    desc: 'Calculates BMR, TDEE, and daily macro targets based on your body composition, activity level, and goals.',
  },
  {
    number: 3,
    name: 'Recipe Curator',
    shortDesc: 'AI-generates meals',
    desc: 'Creates 7 days of meals that hit your macro targets while respecting your cuisine preferences and restrictions.',
  },
  {
    number: 4,
    name: 'Nutrition Compiler',
    shortDesc: 'Verifies via FatSecret',
    desc: 'Cross-references every ingredient against the FatSecret database for verified, accurate nutrition data.',
  },
  {
    number: 5,
    name: 'QA Validator',
    shortDesc: 'Enforces tolerances',
    desc: 'Runs tolerance checks on calorie and macro totals, flagging and fixing any meals that drift outside your targets.',
  },
  {
    number: 6,
    name: 'Brand Renderer',
    shortDesc: 'Builds deliverables',
    desc: 'Compiles your final plan with formatted meals, grocery lists, prep instructions, and daily breakdowns.',
  },
];

export function PipelineVisualizer() {
  const [activeAgent, setActiveAgent] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoCycle = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setActiveAgent((prev) => (prev + 1) % 6);
    }, 3000);
  }, []);

  useEffect(() => {
    if (!userInteracted) {
      startAutoCycle();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userInteracted, startAutoCycle]);

  const handleAgentClick = (index: number) => {
    setUserInteracted(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveAgent(index);
  };

  return (
    <div>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start gap-2">
        {agents.map((agent, i) => (
          <div key={agent.number} className="flex items-start flex-1">
            <button
              onClick={() => handleAgentClick(i)}
              className={`w-full rounded-xl border p-4 text-left transition-all duration-300 cursor-pointer ${
                i === activeAgent
                  ? 'border-primary bg-primary/5 scale-105 shadow-lg shadow-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold mb-3 ${
                  i === activeAgent
                    ? 'bg-primary text-background'
                    : 'bg-border text-muted-foreground'
                }`}
              >
                {agent.number}
              </div>
              <p
                className={`text-sm font-bold ${i === activeAgent ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {agent.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{agent.shortDesc}</p>
              {i === activeAgent && (
                <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
                  {agent.desc}
                </p>
              )}
            </button>
            {i < 5 && (
              <div className="flex items-center self-center pt-6 px-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className={`shrink-0 transition-colors duration-300 ${
                    i < activeAgent ? 'text-primary' : 'text-border'
                  }`}
                >
                  <path
                    d="M6 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden space-y-0">
        {agents.map((agent, i) => (
          <div key={agent.number} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
                  i === activeAgent
                    ? 'bg-primary text-background'
                    : 'bg-border text-muted-foreground'
                }`}
              >
                {agent.number}
              </div>
              {i < 5 && (
                <div
                  className={`w-px flex-1 min-h-[24px] transition-colors duration-300 ${
                    i < activeAgent ? 'bg-primary/50' : 'bg-border'
                  }`}
                />
              )}
            </div>
            <button
              onClick={() => handleAgentClick(i)}
              className={`flex-1 rounded-xl border p-4 mb-2 text-left transition-all duration-300 cursor-pointer ${
                i === activeAgent
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <p
                className={`text-sm font-bold ${i === activeAgent ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {agent.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{agent.shortDesc}</p>
              {i === activeAgent && (
                <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
                  {agent.desc}
                </p>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
