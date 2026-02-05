'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { TRPCProvider } from './TRPCProvider'
import { Toaster } from '@/components/ui/Toaster'
import { SignOutListener } from './SignOutListener'

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: 'var(--primary)',
    colorBackground: 'var(--card)',
    colorText: 'var(--foreground)',
    colorTextSecondary: 'var(--muted-foreground)',
    colorInputBackground: 'var(--card)',
    colorInputText: 'var(--foreground)',
    borderRadius: '0.5rem',
  },
  elements: {
    formButtonPrimary:
      'bg-primary hover:bg-primary/90 text-background font-bold uppercase tracking-wide transition-colors',
    card: 'bg-card border border-border shadow-xl rounded-xl',
    headerTitle: 'text-foreground font-bold',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButton:
      'bg-background border border-border text-foreground hover:bg-card transition-colors',
    formFieldInput:
      'bg-background border border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary',
    footerActionLink: 'text-primary hover:text-primary/90',
  },
} as const

export function Providers({ children }: { children: React.ReactNode }) {
  // Dev-mode bypass: skip ClerkProvider when no publishable key is configured
  if (!clerkPublishableKey) {
    return (
      <TRPCProvider>
        <SignOutListener />
        {children}
        <Toaster />
      </TRPCProvider>
    )
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={clerkAppearance}
    >
      <TRPCProvider>
        <SignOutListener />
        {children}
        <Toaster />
      </TRPCProvider>
    </ClerkProvider>
  )
}
