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
    colorPrimary: '#f97316',
    colorBackground: '#1a1a1a',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#1e1e1e',
    colorInputText: '#fafafa',
    borderRadius: '0.5rem',
  },
  elements: {
    formButtonPrimary:
      'bg-[#f97316] hover:bg-[#ea580c] text-[#0a0a0a] font-bold uppercase tracking-wide transition-colors',
    card: 'bg-[#1a1a1a] border border-[#2a2a2a] shadow-xl rounded-xl',
    headerTitle: 'text-[#fafafa] font-bold',
    headerSubtitle: 'text-[#a1a1aa]',
    socialButtonsBlockButton:
      'bg-[#0a0a0a] border border-[#2a2a2a] text-[#fafafa] hover:bg-[#1e1e1e] transition-colors',
    formFieldInput:
      'bg-[#0a0a0a] border border-[#2a2a2a] text-[#fafafa] focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]',
    footerActionLink: 'text-[#f97316] hover:text-[#ea580c]',
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
