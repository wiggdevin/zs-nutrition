import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { isDevMode } from '@/lib/dev-mode'

export default async function HomePage() {
  let userId: string | null = null;

  if (isDevMode) {
    // In dev mode, check for dev-user-id cookie
    const cookieStore = await cookies();
    userId = cookieStore.get('dev-user-id')?.value || null;
  } else {
    const { auth } = await import('@clerk/nextjs/server');
    const result = await auth();
    userId = result.userId;
  }

  if (userId) {
    redirect('/dashboard')
  }

  // Landing page for unauthenticated users
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-background">
      {/* Header / Nav */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">ZS</span>
          </div>
          <span className="text-lg font-bold uppercase tracking-wide text-foreground">
            ZS-<span className="text-primary">MAC</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto max-w-3xl">
          {/* Logo Mark */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/90 shadow-lg shadow-primary/20">
              <span className="text-2xl font-bold text-white">ZS</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-heading uppercase tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Zero Sum{' '}
            <span className="text-primary">Nutrition</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-lg text-muted-foreground sm:text-xl lg:text-2xl">
            AI-powered meal planning &amp; macro tracking
          </p>

          <p className="mt-2 max-w-xl mx-auto text-sm text-muted-foreground sm:text-base">
            Transform your health goals into a personalized 7-day meal plan with verified nutrition data,
            powered by our 6-agent AI pipeline.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="w-full rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 sm:w-auto"
            >
              Start Free Plan
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-xl border border-border bg-card px-8 py-3.5 text-base font-semibold text-foreground transition-all hover:border-border/80 hover:bg-secondary sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Personalized Plans</h3>
            <p className="mt-1 text-xs text-muted-foreground">7-day meal plans tailored to your goals and preferences</p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <svg className="h-5 w-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Macro Tracking</h3>
            <p className="mt-1 text-xs text-muted-foreground">Track calories, protein, carbs, and fats with precision</p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
              <svg className="h-5 w-5 text-chart-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">AI-Powered</h3>
            <p className="mt-1 text-xs text-muted-foreground">6-agent pipeline with verified FatSecret nutrition data</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Zero Sum Nutrition. All rights reserved.</p>
      </footer>
    </div>
  )
}
