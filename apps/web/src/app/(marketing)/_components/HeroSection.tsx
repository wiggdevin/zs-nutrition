import Link from 'next/link';

interface HeroSectionProps {
  appUrl: string;
}

export function HeroSection({ appUrl: _appUrl }: HeroSectionProps) {
  return (
    <>
      {/* ─── SECTION 1: STICKY HEADER ─── */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-12">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-white">ZS</span>
            </div>
            <span className="whitespace-nowrap text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
              ZS-<span className="text-primary">MAC</span>
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="whitespace-nowrap rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-lg bg-primary px-4 py-3 text-sm font-medium text-background transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── SECTION 2: HERO ─── */}
      <section className="relative flex items-center pt-20 pb-12 lg:min-h-screen lg:pb-0">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
          {/* Left: Copy */}
          <div className="flex flex-col justify-center">
            <p
              className="section-label text-primary"
              style={{ animation: 'fadeInUp 0.6s ease-out both' }}
            >
              {'/// AI-POWERED NUTRITION'}
            </p>
            <h1
              className="mt-4 font-heading text-4xl uppercase leading-[1.2] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}
            >
              STOP GUESSING<span className="text-primary">.</span>
              <br />
              START ENGINEERING
              <br />
              YOUR <span className="text-primary">BIOLOGY</span>
              <span className="text-primary">.</span>
            </h1>
            <p
              className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}
            >
              Our 6-agent AI pipeline builds you a personalized 7-day meal plan with
              FatSecret-verified nutrition data — in under 2 minutes.
            </p>
            <div
              className="mt-8 flex flex-col gap-4 sm:flex-row"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.3s both' }}
            >
              <Link
                href="/sign-up"
                className="rounded-xl bg-primary px-8 py-3.5 text-center text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40"
              >
                Start Free Plan
              </Link>
              <Link
                href="/sign-in"
                className="rounded-xl border border-border bg-card px-8 py-3.5 text-center text-base font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-secondary"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Right: Mock dashboard card */}
          <div
            className="flex items-center justify-center"
            style={{ animation: 'fadeInUp 0.6s ease-out 0.4s both' }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-sm"
              style={{ animation: 'pulse-glow 4s ease-in-out infinite' }}
            >
              {/* Mock header */}
              <div className="mb-4 flex items-center justify-between">
                <p className="section-label text-muted-foreground">{'/// DAILY OVERVIEW'}</p>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-mono text-primary">
                  Day 3 of 7
                </span>
              </div>

              {/* Mock macro rings */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Cal', current: 1847, target: 2200, color: 'var(--primary)' },
                  { label: 'Protein', current: 142, target: 165, color: 'var(--chart-2)' },
                  { label: 'Carbs', current: 198, target: 248, color: 'var(--chart-3)' },
                  { label: 'Fat', current: 58, target: 73, color: 'var(--chart-4)' },
                ].map((macro) => {
                  const size = 72;
                  const strokeWidth = 5;
                  const radius = (size - strokeWidth) / 2;
                  const circumference = 2 * Math.PI * radius;
                  const progress = macro.current / macro.target;
                  const dashOffset = circumference * (1 - progress);
                  return (
                    <div key={macro.label} className="flex flex-col items-center gap-1">
                      <div className="relative" style={{ width: size, height: size }}>
                        <svg width={size} height={size} className="-rotate-90">
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth={strokeWidth}
                          />
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={macro.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span
                            className="text-xs font-bold font-mono"
                            style={{ color: macro.color }}
                          >
                            {macro.current}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                        {macro.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Floating status pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className="rounded-full border border-chart-2/30 bg-chart-2/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-chart-2"
                  style={{ animation: 'float 3s ease-in-out infinite' }}
                >
                  FatSecret Verified
                </span>
                <span
                  className="rounded-full border border-chart-3/30 bg-chart-3/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-chart-3"
                  style={{ animation: 'float 3s ease-in-out 0.5s infinite' }}
                >
                  QA Validated
                </span>
                <span
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-primary"
                  style={{ animation: 'float 3s ease-in-out 1s infinite' }}
                >
                  On Track
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
