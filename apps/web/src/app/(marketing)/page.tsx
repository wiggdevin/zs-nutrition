import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { isDevMode } from '@/lib/dev-mode';
import { AnimatedCounter } from './_components/AnimatedCounter';
import { PipelineVisualizer } from './_components/PipelineVisualizer';
import { ScrollReveal } from './_components/ScrollReveal';
import { FAQ } from './_components/FAQ';

export const metadata: Metadata = {
  title: 'AI-Powered Meal Planning & Macro Tracking',
  description:
    'Join thousands of health-conscious individuals using AI-powered meal plans tailored to your fitness goals and dietary preferences. Free to start.',
  openGraph: {
    title: 'Zero Sum Nutrition — AI-Powered Meal Planning',
    description: 'Get personalized meal plans and track macros with AI. Free to start.',
  },
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  let userId: string | null = null;

  if (isDevMode) {
    const cookieStore = await cookies();
    userId = cookieStore.get('dev-user-id')?.value || null;
  } else {
    const { auth } = await import('@clerk/nextjs/server');
    const result = await auth();
    userId = result.userId;
  }

  if (userId) {
    redirect('/dashboard');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zerosumnutrition.com';

  // Server-generated structured data for SEO - safe to use dangerouslySetInnerHTML
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Zero Sum Nutrition',
        description: 'AI-powered personalized meal planning and macro tracking',
        url: appUrl,
      },
      {
        '@type': 'WebApplication',
        name: 'Zero Sum Nutrition',
        description: 'Personalized meal planning and macro tracking powered by AI',
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web',
        url: appUrl,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free meal planning and macro tracking',
        },
        featureList: [
          '6-Agent AI Pipeline',
          'FatSecret-Verified Nutrition Data',
          'Claude Vision Photo Scanning',
          '7-Day Personalized Meal Plans',
          'Real-Time Macro Tracking',
        ],
      },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      <div className="relative min-h-screen bg-background">
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

        <main id="main-content">
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

          {/* ─── SECTION 3: TRUST BAR ─── */}
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
                    <AnimatedCounter
                      target={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                    />
                  </span>
                  <span className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ─── SECTION 3.5: TESTIMONIALS ─── */}
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

          {/* ─── SECTION 4: HOW IT WORKS — 6-AGENT PIPELINE ─── */}
          <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
            <div className="mb-12 text-center">
              <p className="section-label text-primary">{'/// THE ENGINE'}</p>
              <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                6 AI AGENTS<span className="text-primary">.</span> ONE PIPELINE
                <span className="text-primary">.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
                Each agent in our pipeline has a specialized role. Together, they build a nutrition
                plan that&apos;s accurate, personalized, and verified.
              </p>
            </div>
            <PipelineVisualizer />
          </section>

          {/* ─── SECTION 5: FEATURES GRID (BENTO LAYOUT) ─── */}
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
                    See each agent work in real-time via server-sent events. Know exactly
                    what&apos;s happening at every step.
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

          {/* ─── SECTION 6: DIFFERENTIATORS ─── */}
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
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ─── SECTION 7: WHAT YOU GET ─── */}
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
                        <li
                          key={item}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
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

          {/* ─── SECTION 7.5: FAQ ─── */}
          <section className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-20 lg:py-28">
            <div className="mb-12 text-center">
              <p className="section-label text-primary">{'/// FAQ'}</p>
              <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                COMMON QUESTIONS<span className="text-primary">.</span>
              </h2>
            </div>
            <FAQ />
          </section>

          {/* ─── SECTION 8: FINAL CTA ─── */}
          <section className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
            <div className="relative mx-auto max-w-3xl px-6 py-12 text-center sm:px-8 sm:py-20 lg:py-28">
              <h2 className="font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                YOUR FIRST PLAN IS FREE<span className="text-primary">.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
                Set your goals, answer a few questions, and watch 6 AI agents build your
                personalized nutrition plan in real-time.
              </p>
              <Link
                href="/sign-up"
                className="mt-8 inline-block rounded-xl bg-primary px-10 py-4 text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40"
              >
                Get Started — It&apos;s Free
              </Link>
              <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {'/// Zero setup fees. Zero selling your data.'}
              </p>
            </div>
          </section>
        </main>

        {/* ─── SECTION 9: FOOTER ─── */}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                  <span className="text-[10px] font-bold text-white">ZS</span>
                </div>
                <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                  ZS-<span className="text-primary">MAC</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/privacy"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Privacy
                </Link>
                <Link
                  href="/terms"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Terms
                </Link>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} Zero Sum Nutrition
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
