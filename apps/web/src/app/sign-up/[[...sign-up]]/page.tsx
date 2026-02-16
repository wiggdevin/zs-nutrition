import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { DevSignUpForm } from './SignUpContent';
import { isDevMode } from '@/lib/dev-mode';

export const metadata: Metadata = {
  title: 'Create Your Account',
  description:
    'Sign up for Zero Sum Nutrition and start your personalized meal planning journey with AI-powered nutrition tracking.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: '/sign-up',
  },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-wide text-foreground">
            Zero Sum <span className="text-primary">Nutrition</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered meal planning &amp; macro tracking
          </p>
        </div>
        {isDevMode ? (
          <DevSignUpForm />
        ) : (
          <SignUp
            appearance={{
              elements: {
                rootBox: 'mx-auto w-full',
                card: 'bg-card border border-border shadow-2xl rounded-xl',
                headerTitle: 'text-foreground font-bold text-xl',
                headerSubtitle: 'text-muted-foreground',
                formButtonPrimary:
                  'bg-primary hover:bg-primary/90 text-background font-bold uppercase tracking-wide transition-colors',
                formFieldInput:
                  'bg-background border border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary',
                formFieldLabel: 'text-muted-foreground',
                socialButtonsBlockButton:
                  'bg-background border border-border text-foreground hover:bg-card transition-colors',
                socialButtonsBlockButtonText: 'text-foreground font-medium',
                dividerLine: 'bg-border',
                dividerText: 'text-muted-foreground',
                footerActionLink: 'text-primary hover:text-primary/90 font-medium',
                identityPreviewEditButton: 'text-primary',
                formResendCodeLink: 'text-primary',
              },
            }}
            signInUrl="/sign-in"
            forceRedirectUrl="/onboarding"
          />
        )}
      </div>
    </div>
  );
}
