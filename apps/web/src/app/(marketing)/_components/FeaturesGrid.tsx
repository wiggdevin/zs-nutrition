import { ScrollReveal } from './ScrollReveal';

export function FeaturesGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
      <div className="mb-12 text-center">
        <p className="section-label text-primary">{'/// FEATURES'}</p>
        <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          BUILT FOR RESULTS<span className="text-primary">.</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        {/* 7-Day Personalized Plans (large) */}
        <ScrollReveal className="sm:col-span-8" delay={0}>
          <div className="rounded-2xl border border-border border-t-2 border-t-primary/40 bg-card p-6 transition-all duration-300 hover:border-primary/30 sm:border-t sm:border-t-border sm:p-8 h-full">
            <p className="section-label text-primary mb-3">{'/// MEAL PLANNING'}</p>
            <h3 className="font-heading text-xl uppercase tracking-tight text-foreground sm:text-2xl">
              7-Day Personalized Plans
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Custom meal plans tailored to your exact calorie and macro targets, dietary
              restrictions, and cuisine preferences.
            </p>
            {/* Mini day-of-week pills */}
            <div className="mt-5 flex gap-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div
                  key={`${day}-${i}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-mono font-bold ${
                    i < 3
                      ? 'bg-primary text-background'
                      : i === 3
                        ? 'border border-primary bg-primary/10 text-primary'
                        : 'border border-border bg-card text-muted-foreground'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Snap & Track (small) */}
        <ScrollReveal className="sm:col-span-4" delay={100}>
          <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 h-full">
            <p className="section-label text-primary mb-3">{'/// VISION AI'}</p>
            <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">
              Snap &amp; Track
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Take a photo of your meal. Claude Vision identifies ingredients and logs macros
              automatically.
            </p>
            {/* Mini camera icon */}
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary">
              <svg
                className="h-6 w-6 text-primary"
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
          </div>
        </ScrollReveal>

        {/* Macro Tracking (small) */}
        <ScrollReveal className="sm:col-span-4" delay={200}>
          <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 h-full">
            <p className="section-label text-primary mb-3">{'/// TRACKING'}</p>
            <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">
              Macro Tracking
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Interactive ring charts and weekly trend graphs keep you accountable.
            </p>
            {/* Mini ring mockup */}
            <div className="mt-5 flex gap-3">
              {[
                { color: 'var(--primary)', pct: 0.84 },
                { color: 'var(--chart-2)', pct: 0.72 },
                { color: 'var(--chart-3)', pct: 0.65 },
              ].map((ring, i) => {
                const s = 36;
                const sw = 3;
                const r = (s - sw) / 2;
                const c = 2 * Math.PI * r;
                return (
                  <svg key={i} width={s} height={s} className="-rotate-90">
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
                    />
                  </svg>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* Watch Your Plan Being Built (large) */}
        <ScrollReveal className="sm:col-span-8" delay={300}>
          <div className="rounded-2xl border border-border border-t-2 border-t-primary/40 bg-card p-6 transition-all duration-300 hover:border-primary/30 sm:border-t sm:border-t-border sm:p-8 h-full">
            <p className="section-label text-primary mb-3">{'/// REAL-TIME'}</p>
            <h3 className="font-heading text-xl uppercase tracking-tight text-foreground sm:text-2xl">
              Watch Your Plan Being Built
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              See each agent work in real-time via server-sent events. Know exactly what&apos;s
              happening at every step.
            </p>
            {/* Mini agent progress mockup */}
            <div className="mt-5 space-y-2">
              {[
                { name: 'Intake Normalizer', done: true, active: false },
                { name: 'Metabolic Calculator', done: true, active: false },
                { name: 'Recipe Curator', done: false, active: true },
                { name: 'Nutrition Compiler', done: false, active: false },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                    step.done
                      ? 'border-chart-2/20 bg-chart-2/5'
                      : step.active
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card opacity-40'
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      step.done
                        ? 'bg-chart-2 text-white'
                        : step.active
                          ? 'bg-primary text-background'
                          : 'bg-border text-muted-foreground'
                    }`}
                  >
                    {step.done ? '\u2713' : i + 1}
                  </div>
                  <span
                    className={
                      step.done || step.active
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    {step.name}
                  </span>
                  {step.active && (
                    <div className="ml-auto h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
