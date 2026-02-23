import { AnimatedCounter } from './AnimatedCounter';

export function TrustBar() {
  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-8 sm:px-8 sm:py-12 lg:grid-cols-4 lg:py-16">
        {[
          { value: 6, suffix: '', label: 'AI Agents' },
          { value: 7, suffix: '', label: 'Days Per Plan' },
          { value: 100, suffix: '%', label: 'Verified Data' },
          { value: 2, prefix: '<', suffix: ' Min', label: 'Setup Time' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center text-center">
            <span className="text-3xl font-bold text-foreground sm:text-4xl">
              <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
            </span>
            <span className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
