import { ScrollReveal } from './ScrollReveal';

export function WhatYouGetSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
      <div className="mb-12 text-center">
        <p className="section-label text-primary">{'/// INCLUDED FREE'}</p>
        <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          EVERYTHING YOU NEED<span className="text-primary">.</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          {
            title: 'Your 7-Day Plan',
            items: [
              'Custom meals for every day',
              'Full grocery list',
              'Prep instructions',
              'Macro breakdown per meal',
            ],
          },
          {
            title: 'Daily Tracking',
            items: [
              'Interactive macro rings',
              'FatSecret food search',
              'Photo scanning with Vision AI',
              'Daily progress dashboard',
            ],
          },
          {
            title: 'Smart Insights',
            items: [
              'Adherence scoring',
              'Weekly trend graphs',
              'Training/rest day awareness',
              'Calorie target adjustments',
            ],
          },
        ].map((card, i) => (
          <ScrollReveal key={card.title} delay={i * 100}>
            <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 h-full">
              <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">
                {card.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {card.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
