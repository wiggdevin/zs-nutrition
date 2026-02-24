import { SignIn } from '@clerk/nextjs';
import { DevSignInForm } from './SignInContent';

const isDevMode =
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY === 'sk_test_placeholder' ||
  process.env.CLERK_SECRET_KEY === '';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-wide text-[#fafafa]">
            Zero Sum <span className="text-[#f97316]">Nutrition</span>
          </h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            AI-powered meal planning &amp; macro tracking
          </p>
        </div>
        {isDevMode ? (
          <DevSignInForm />
        ) : (
          <SignIn
            appearance={{
              elements: {
                rootBox: 'mx-auto w-full',
                card: 'bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl rounded-xl',
                headerTitle: 'text-[#fafafa] font-bold text-xl',
                headerSubtitle: 'text-[#a1a1aa]',
                formButtonPrimary:
                  'bg-[#f97316] hover:bg-[#ea580c] text-white font-bold uppercase tracking-wide transition-colors',
                formFieldInput:
                  'bg-[#0a0a0a] border border-[#2a2a2a] text-[#fafafa] focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]',
                formFieldLabel: 'text-[#a1a1aa]',
                socialButtonsBlockButton:
                  'bg-[#0a0a0a] border border-[#2a2a2a] text-[#fafafa] hover:bg-[#1e1e1e] transition-colors',
                socialButtonsBlockButtonText: 'text-[#fafafa] font-medium',
                dividerLine: 'bg-[#2a2a2a]',
                dividerText: 'text-[#a1a1aa]',
                footerActionLink: 'text-[#f97316] hover:text-[#ea580c] font-medium',
              },
            }}
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
          />
        )}
      </div>
    </div>
  );
}
