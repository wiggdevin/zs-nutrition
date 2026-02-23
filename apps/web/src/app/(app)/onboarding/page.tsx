'use client';

import dynamic from 'next/dynamic';

const OnboardingWizard = dynamic(
  () =>
    import('@/components/onboarding/OnboardingWizard').then((mod) => ({
      default: mod.OnboardingWizard,
    })),
  {
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-2xl mx-auto p-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-12 bg-muted rounded-lg animate-pulse" />
            <div className="h-12 bg-muted rounded-lg animate-pulse" />
            <div className="h-12 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
