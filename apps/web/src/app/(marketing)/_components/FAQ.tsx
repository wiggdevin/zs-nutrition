'use client';

import { useState } from 'react';
import { ScrollReveal } from './ScrollReveal';

const faqs = [
  {
    q: 'How does the AI pipeline work?',
    a: 'Our 6-agent pipeline processes your profile through specialized AI agents: intake normalization, metabolic calculation, recipe curation (with FatSecret data), nutrition compilation, QA validation, and brand rendering. Each agent has a specific role, ensuring accuracy at every step.',
  },
  {
    q: 'Is my data private and secure?',
    a: 'Absolutely. Your nutrition data is encrypted at rest and in transit. We never sell your data to advertisers or third parties. Your meal plans and tracking data are yours alone.',
  },
  {
    q: 'How accurate is the nutrition data?',
    a: 'Every ingredient is cross-referenced against the FatSecret database, one of the most comprehensive food databases available. Our QA validator agent checks each meal plan against your macro targets before delivery.',
  },
  {
    q: 'Can I customize my meal plan after generation?',
    a: 'Yes. You can swap individual meals for alternatives that match your macro targets, adjust portion sizes, and request a full plan regeneration anytime your goals change.',
  },
  {
    q: 'What dietary restrictions are supported?',
    a: 'We support omnivore, vegetarian, vegan, pescatarian, keto, and paleo dietary styles. You can also specify allergies, food exclusions, and cuisine preferences during onboarding.',
  },
  {
    q: 'How long does plan generation take?',
    a: "Most plans are generated in under 2 minutes. You can watch each AI agent work in real-time via our progress tracker — it's like watching your nutrition protocol being engineered live.",
  },
  {
    q: 'Is it really free?',
    a: 'Your first 7-day meal plan is completely free. No credit card required. No hidden fees. We believe you should experience the full pipeline before making any commitment.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <ScrollReveal key={i} delay={i * 80}>
          <div className="rounded-xl border border-border bg-card transition-colors hover:border-primary/20">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-semibold text-foreground pr-4">{faq.q}</span>
              <svg
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              className="grid transition-all duration-200 ease-in-out"
              style={{
                gridTemplateRows: openIndex === i ? '1fr' : '0fr',
              }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}
