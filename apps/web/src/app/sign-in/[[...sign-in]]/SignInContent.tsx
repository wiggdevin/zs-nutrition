'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { validateEmail } from '@/lib/validation'

// Dev mode sign-in form that simulates the Clerk flow
export function DevSignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'email' | 'verify'>('email')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate email format using Zod schema
    const validation = validateEmail(email)
    if (!validation.isValid) {
      setError(validation.error || 'Please enter a valid email address')
      return
    }

    setIsLoading(true)

    // Simulate sending magic link
    setTimeout(() => {
      setIsLoading(false)
      setStep('verify')
    }, 1000)
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dev-auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Sign in failed')
        setIsLoading(false)
        return
      }
      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  if (step === 'verify') {
    return (
      <div className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f97316]/10">
            <svg className="h-6 w-6 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#fafafa]">Check your email</h2>
          <p className="text-sm text-[#a1a1aa]">
            We sent a sign-in link to <span className="text-[#fafafa]">{email}</span>
          </p>
          <p className="text-xs text-[#a1a1aa]/60 font-mono">
            [DEV MODE] Click below to simulate sign-in
          </p>
          <button
            onClick={handleVerify}
            disabled={isLoading}
            className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c] disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In & Continue'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl">
      <div className="space-y-1 mb-6">
        <h2 className="text-xl font-bold text-[#fafafa]">Sign in</h2>
        <p className="text-sm text-[#a1a1aa]">to continue to Zero Sum Nutrition</p>
      </div>

      {/* OAuth buttons */}
      <div className="space-y-2 mb-4">
        <button
          onClick={() => {
            setIsLoading(true)
            setTimeout(() => router.push('/dashboard'), 1500)
          }}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2.5 text-sm font-medium text-[#fafafa] transition-colors hover:bg-[#1e1e1e]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#2a2a2a]"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#1a1a1a] px-2 text-[#a1a1aa]">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-[#a1a1aa]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#fafafa] placeholder-[#a1a1aa]/40 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            required
          />
          {error && (
            <p className="mt-1 text-xs text-[#ef4444]">{error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c] disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending link...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[#a1a1aa]">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="font-medium text-[#f97316] hover:text-[#ea580c]">
          Sign up
        </Link>
      </p>

      <p className="mt-3 text-center text-[10px] font-mono text-[#a1a1aa]/40 uppercase tracking-wider">
        Dev Mode — Clerk keys not configured
      </p>
    </div>
  )
}
