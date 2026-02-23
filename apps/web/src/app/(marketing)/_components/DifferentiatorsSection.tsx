import { ScrollReveal } from './ScrollReveal';

export function DifferentiatorsSection() {
  return (
    <section className="border-y border-border bg-card/30">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 sm:px-8 lg:grid-cols-2 lg:px-12 lg:py-28">
        <div className="flex flex-col justify-center">
          <p className="section-label text-primary">{'/// DIFFERENT BY DESIGN'}</p>
          <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            NOT ANOTHER
            <br />
            DIET APP<span className="text-primary">.</span>
          </h2>
        </div>
        <div className="space-y-6">
          {[
            {
              title: 'FatSecret-Verified Data',
              desc: 'Every ingredient cross-referenced against the FatSecret database. No guessing, no generic estimates.',
            },
            {
              title: 'Adaptive Calorie Targets',
              desc: 'Training days vs rest days. Your plan adjusts macros based on your actual activity schedule.',
            },
            {
              title: 'QA Validation Loop',
              desc: 'Agent 5 runs tolerance checks on every meal. If a day drifts outside your targets, it gets fixed.',
            },
            {
              title: 'Privacy-First Architecture',
              desc: 'Your data stays yours. No selling to advertisers. No third-party tracking. Period.',
            },
          ].map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 100}>
              <div className="border-l-2 border-primary/30 pl-6 transition-colors duration-300 hover:border-primary">
                <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
