/**
 * Dev mode sign-in page for testing
 */

'use client'

import { notFound } from 'next/navigation'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DevSignInPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const router = useRouter()
  const [email, setEmail] = useState('test-416-adherence@example.com')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignIn = async () => {
    setLoading(true)
    setMessage('')

    try {
      // First try to sign in (existing user)
      let response = await fetch('/api/dev-auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      let data = await response.json()

      // If user doesn't exist, sign them up
      if (!response.ok && data.error?.includes('No account found')) {
        response = await fetch('/api/dev-auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        data = await response.json()
      }

      if (response.ok) {
        setMessage(`✅ Signed in as ${email}`)
        setTimeout(() => {
          router.push(data.redirectTo || '/dashboard')
        }, 1000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (err) {
      setMessage(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-[#1a1a1a] rounded-lg p-8 border border-[#2a2a2a]">
        <h1 className="text-2xl font-bold mb-6 text-center">Dev Mode Sign In</h1>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded focus:outline-none focus:border-[#f97316]"
              placeholder="test@example.com"
            />
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-3 bg-[#f97316] hover:bg-[#f97316]/90 rounded font-semibold disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {message && (
            <div className="text-center text-sm py-2">
              {message}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-[#2a2a2a] text-sm text-[#a1a1aa]">
          <p className="mb-2">This is a dev-only sign-in page for testing purposes.</p>
          <p>After signing in, you'll be redirected to the test page.</p>
        </div>
      </div>
    </div>
  )
}
