import { ScrollReveal } from './ScrollReveal';

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-20 lg:px-12">
      <div className="mb-12 text-center">
        <p className="section-label text-primary">{'/// REAL RESULTS'}</p>
        <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          PEOPLE ARE CRUSHING IT<span className="text-primary">.</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          {
            name: 'Alex K.',
            result: 'Lost 12 lbs in 8 weeks',
            quote:
              'The AI-generated meal plans actually fit my schedule. I stopped skipping meals and my energy levels are through the roof.',
          },
          {
            name: 'Sarah M.',
            result: 'Hit protein goals consistently',
            quote:
              'As a vegetarian, hitting my protein targets was always a struggle. Zero Sum found combinations I never would have thought of.',
          },
          {
            name: 'Mike D.',
            result: 'Gained 8 lbs lean mass',
            quote:
              "The training day vs rest day macro adjustments made a real difference. My bulk is clean and I'm not gaining unnecessary fat.",
          },
        ].map((t, i) => (
          <ScrollReveal key={t.name} delay={i * 100}>
            <div className="rounded-2xl border border-border border-l-2 border-l-primary/40 bg-card p-6 h-full">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <svg
                    key={j}
                    className="h-4 w-4 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-primary font-mono">{t.result}</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
