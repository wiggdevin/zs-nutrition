import type { Metadata } from 'next';
import Link from 'next/link';
import { AnimatedCounter } from './components/AnimatedCounter';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { ScrollReveal } from './components/ScrollReveal';
import { FAQ } from './components/FAQ';
import { HeroAnimation } from './components/HeroAnimation';
import { FeatureBento } from './components/FeatureBento';
import { Marquee } from './components/Marquee';
import { Testimonials } from './components/Testimonials';

export const metadata: Metadata = {
  title: 'AI-Powered Meal Planning & Macro Tracking',
  description:
    'Join thousands of health-conscious individuals using AI-powered meal plans tailored to your fitness goals and dietary preferences. Free to start.',
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
              <span className="text-sm font-bold text-background">ZS</span>
            </div>
            <span className="whitespace-nowrap text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
              ZS-<span className="text-primary">MAC</span>
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="#"
              className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="#"
              className="whitespace-nowrap rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="relative flex items-center pt-20 pb-16 lg:min-h-screen lg:pb-0 overflow-hidden">
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
            <div className="flex flex-col justify-center">
              <p
                className="section-label text-primary"
                style={{ animation: 'fadeInUp 0.6s ease-out both' }}
              >
                {'/// AI-POWERED NUTRITION'}
              </p>
              <h1
                className="mt-4 font-heading text-4xl uppercase leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance"
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
                  href="#"
                  className="group relative rounded-xl bg-primary px-8 py-3.5 text-center text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="relative z-10">Start Free Plan</span>
                </Link>
                <Link
                  href="#"
                  className="rounded-xl border border-border bg-card px-8 py-3.5 text-center text-base font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-secondary hover:-translate-y-0.5 active:translate-y-0"
                >
                  Sign In
                </Link>
              </div>
            </div>

            <div
              className="flex items-center justify-center"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.4s both' }}
            >
              <HeroAnimation />
            </div>
          </div>
        </section>

        {/* Marquee */}
        <Marquee />

        {/* Trust Bar */}
        <section className="border-b border-border bg-card/50">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-10 sm:px-8 sm:py-14 lg:grid-cols-4 lg:py-16">
            {[
              { value: 6, suffix: '', label: 'AI Agents' },
              { value: 7, suffix: '', label: 'Days Per Plan' },
              { value: 100, suffix: '%', label: 'Verified Data' },
              { value: 2, prefix: '<', suffix: ' Min', label: 'Setup Time' },
            ].map((stat) => (
              <ScrollReveal key={stat.label} delay={0}>
                <div className="flex flex-col items-center text-center group cursor-default">
                  <span className="text-3xl font-bold text-foreground sm:text-4xl transition-colors duration-300 group-hover:text-primary">
                    <AnimatedCounter
                      target={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix}
                    />
                  </span>
                  <span className="mt-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mb-14 text-center">
            <p className="section-label text-primary">{'/// REAL RESULTS'}</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
              PEOPLE ARE CRUSHING IT<span className="text-primary">.</span>
            </h2>
          </div>
          <Testimonials />
        </section>

        {/* 6-Agent Pipeline */}
        <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mb-14 text-center">
            <p className="section-label text-primary">{'/// THE ENGINE'}</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
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

        {/* Features Bento Grid */}
        <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mb-14 text-center">
            <p className="section-label text-primary">{'/// FEATURES'}</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
              BUILT FOR RESULTS<span className="text-primary">.</span>
            </h2>
          </div>
          <FeatureBento />
        </section>

        {/* Differentiators */}
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
                  <div className="group border-l-2 border-primary/30 pl-6 transition-all duration-300 hover:border-primary">
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* What You Get */}
        <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mb-14 text-center">
            <p className="section-label text-primary">{'/// INCLUDED FREE'}</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
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
                <div className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 h-full">
                  <h3 className="font-heading text-lg uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
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

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="mb-14 text-center">
            <p className="section-label text-primary">{'/// FAQ'}</p>
            <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
              COMMON QUESTIONS<span className="text-primary">.</span>
            </h2>
          </div>
          <FAQ />
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-6 py-16 text-center sm:px-8 sm:py-24 lg:py-28">
            <ScrollReveal>
              <h2 className="font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
                YOUR FIRST PLAN IS FREE<span className="text-primary">.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
                Set your goals, answer a few questions, and watch 6 AI agents build your
                personalized nutrition plan in real-time.
              </p>
              <Link
                href="#"
                className="mt-8 inline-block rounded-xl bg-primary px-10 py-4 text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                {"Get Started — It's Free"}
              </Link>
              <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {'/// Zero setup fees. Zero selling your data.'}
              </p>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shadow-md shadow-primary/20">
                <span className="text-[10px] font-bold text-background">ZS</span>
              </div>
              <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                ZS-<span className="text-primary">MAC</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="#"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="#"
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
  );
}
