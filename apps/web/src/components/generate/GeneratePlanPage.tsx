'use client';

import Link from 'next/link';
import { Confetti } from '../ui/Confetti';
import { usePlanGeneration } from './usePlanGeneration';
import { AgentProgress, agentStages } from './AgentProgress';

export function GeneratePlanPage() {
  const {
    status,
    currentAgent,
    hasProfile,
    profileLoading,
    jobId,
    errorMessage,
    isReconnecting,
    isUsingPolling,
    handleGenerate,
    handleRetry,
  } = usePlanGeneration();

  // Still checking onboarding status
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not completed onboarding
  if (!hasProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg text-center">
          <div className="rounded-lg border border-border bg-card p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-warning bg-warning/10">
              <span className="text-2xl">&#x26A0;&#xFE0F;</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Complete Onboarding First</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to complete your profile setup before generating a meal plan.
            </p>
            <a
              href="/onboarding"
              className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
            >
              Go to Onboarding
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Generating/enqueued state - full screen with agent progress
  if (status === 'generating' || status === 'enqueued') {
    return (
      <AgentProgress
        currentAgent={currentAgent}
        jobId={jobId}
        isUsingPolling={isUsingPolling}
        isReconnecting={isReconnecting}
      />
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <>
        <Confetti duration={2000} particleCount={60} />
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-lg text-center" role="status" aria-live="polite">
            <div className="rounded-lg border border-success/30 bg-card p-8 shadow-xl">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                <span className="text-4xl">&#x1F389;</span>
              </div>
              <h2 className="text-2xl font-heading uppercase tracking-wider text-foreground">
                Plan Generated!
              </h2>
              <p className="mt-2 font-mono text-xs uppercase tracking-widest text-success">
                {'/// ALL 6 AGENTS COMPLETE'}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Your personalized 7-day meal plan is ready.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-primary font-mono uppercase tracking-wide">
                  Redirecting to your meal plan...
                </span>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/meal-plan"
                  className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
                >
                  View Meal Plan
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-block rounded-lg border border-border bg-card px-6 py-3 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-secondary"
                >
                  View Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg text-center" role="alert" aria-live="assertive">
          <div className="rounded-lg border border-destructive/30 bg-card p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <span className="text-2xl">&#x274C;</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Generation Failed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMessage || 'Something went wrong while generating your plan. Please try again.'}
            </p>
            <button
              onClick={handleRetry}
              data-testid="retry-plan-generation"
              className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idle state - ready to generate
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {'/// ZERO SUM NUTRITION'}
          </p>
          <h1 className="text-4xl font-heading uppercase tracking-wider text-foreground">
            Generate Your
            <span className="block text-primary">Protocol</span>
          </h1>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-8 shadow-xl">
          <p className="text-sm text-muted-foreground">
            Your profile is ready. Our 6-agent AI pipeline will create a personalized 7-day meal
            plan with verified nutrition data, optimized for your goals.
          </p>

          <div className="mt-6 space-y-2">
            {agentStages.map((agent) => (
              <div
                key={agent.number}
                className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-xs font-bold text-muted-foreground">
                  {agent.number}
                </span>
                <span className="text-xs text-muted-foreground">{agent.name}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={status !== 'idle'}
            className={`mt-6 w-full rounded-lg px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition-colors ${
              status !== 'idle'
                ? 'cursor-not-allowed bg-primary/50'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {status !== 'idle' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </span>
            ) : (
              'Generate Plan'
            )}
          </button>

          <p className="mt-3 font-mono text-[10px] text-muted-foreground/50">
            Estimated time: 30-120 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
