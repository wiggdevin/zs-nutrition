'use client';

import { useState } from 'react';
import { ScrollReveal } from './ScrollReveal';

const features = [
  {
    label: '/// MEAL PLANNING',
    title: '7-Day Personalized Plans',
    desc: 'Custom meal plans tailored to your exact calorie and macro targets, dietary restrictions, and cuisine preferences.',
    span: 'sm:col-span-8',
    highlight: true,
    content: 'days',
  },
  {
    label: '/// VISION AI',
    title: 'Snap & Track',
    desc: 'Take a photo of your meal. Claude Vision identifies ingredients and logs macros automatically.',
    span: 'sm:col-span-4',
    highlight: false,
    content: 'camera',
  },
  {
    label: '/// TRACKING',
    title: 'Macro Tracking',
    desc: 'Interactive ring charts and weekly trend graphs keep you accountable.',
    span: 'sm:col-span-4',
    highlight: false,
    content: 'rings',
  },
  {
    label: '/// REAL-TIME',
    title: 'Watch Your Plan Being Built',
    desc: "See each agent work in real-time via server-sent events. Know exactly what's happening at every step.",
    span: 'sm:col-span-8',
    highlight: true,
    content: 'pipeline',
  },
] as const;

function DayPills() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="mt-5 flex gap-2">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
        <div
          key={`${day}-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-mono font-bold transition-all duration-300 cursor-pointer ${
            i < 3
              ? 'bg-primary text-background'
              : i === 3
                ? 'border border-primary bg-primary/10 text-primary'
                : 'border border-border bg-card text-muted-foreground'
          } ${hovered === i ? 'scale-110 shadow-lg shadow-primary/20' : ''}`}
        >
          {day}
        </div>
      ))}
    </div>
  );
}

function MiniRings() {
  return (
    <div className="mt-5 flex gap-3">
      {[
        { color: 'var(--primary)', pct: 0.84 },
        { color: 'var(--chart-2)', pct: 0.72 },
        { color: 'var(--chart-3)', pct: 0.65 },
      ].map((ring, i) => {
        const s = 40;
        const sw = 3.5;
        const r = (s - sw) / 2;
        const c = 2 * Math.PI * r;
        return (
          <div key={i} className="group cursor-pointer">
            <svg
              width={s}
              height={s}
              className="-rotate-90 transition-transform duration-300 group-hover:scale-110"
            >
              <circle
                cx={s / 2}
                cy={s / 2}
                r={r}
                fill="none"
                stroke="var(--border)"
                strokeWidth={sw}
              />
              <circle
                cx={s / 2}
                cy={s / 2}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - ring.pct)}
                className="transition-all duration-500"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function PipelineSteps() {
  const [activeStep, setActiveStep] = useState(2);
  const steps = [
    { name: 'Intake Normalizer', done: true },
    { name: 'Metabolic Calculator', done: true },
    { name: 'Recipe Curator', done: false },
    { name: 'Nutrition Compiler', done: false },
  ];

  return (
    <div className="mt-5 space-y-2">
      {steps.map((step, i) => {
        const isDone = i < activeStep;
        const isActive = i === activeStep;
        return (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-all duration-300 cursor-pointer ${
              isDone
                ? 'border-chart-2/20 bg-chart-2/5'
                : isActive
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card opacity-40'
            }`}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                isDone
                  ? 'bg-chart-2 text-background'
                  : isActive
                    ? 'bg-primary text-background'
                    : 'bg-border text-muted-foreground'
              }`}
            >
              {isDone ? '\u2713' : i + 1}
            </div>
            <span
              className={
                isDone || isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
              }
            >
              {step.name}
            </span>
            {isActive && (
              <div className="ml-auto h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CameraIcon() {
  return (
    <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-secondary transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 cursor-pointer group">
      <svg
        className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
        />
      </svg>
    </div>
  );
}

export function FeatureBento() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
      {features.map((feature, i) => (
        <ScrollReveal key={feature.title} className={feature.span} delay={i * 100}>
          <div
            className={`group rounded-2xl border bg-card p-6 transition-all duration-300 hover:border-primary/30 h-full ${
              feature.highlight
                ? 'border-border border-t-2 border-t-primary/40 sm:border-t sm:border-t-border sm:p-8'
                : 'border-border'
            }`}
          >
            <p className="section-label text-primary mb-3">{feature.label}</p>
            <h3
              className={`font-heading uppercase tracking-tight text-foreground ${
                feature.highlight ? 'text-xl sm:text-2xl' : 'text-lg'
              }`}
            >
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            {feature.content === 'days' && <DayPills />}
            {feature.content === 'camera' && <CameraIcon />}
            {feature.content === 'rings' && <MiniRings />}
            {feature.content === 'pipeline' && <PipelineSteps />}
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}
