'use client'

import { notFound } from 'next/navigation'
import { trpc } from '@/lib/trpc'

export default function TestFeature503AuthPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  // Call the protected test procedure
  const { data, isLoading, error } = trpc.test.protectedHello.useQuery()

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">tRPC Auth Context Verification</h1>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Auth Context Test Results:</h2>

          {isLoading && (
            <div className="text-muted-foreground">Loading tRPC query...</div>
          )}

          {error && (
            <div className="text-destructive">
              <p className="font-semibold">Error:</p>
              <pre className="mt-2 bg-destructive/10 p-4 rounded overflow-auto">
                {error.message}
              </pre>
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <div className="text-green-500 font-semibold">✅ Auth context is working!</div>

              <div className="bg-muted p-4 rounded space-y-2">
                <p><strong>Greeting:</strong> {data.greeting}</p>
                <p><strong>User ID:</strong> {data.userId || 'Not available'}</p>
                <p><strong>DB User ID:</strong> {data.dbUserId || 'Not available'}</p>
                <p><strong>Timestamp:</strong> {data.timestamp}</p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>This confirms:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Auth context is available in tRPC procedures</li>
                  <li>Clerk userId is passed to the context</li>
                  <li>Protected procedures work correctly</li>
                  <li>User auto-creation in database works</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Feature 503 - Auth Context Checklist:</h3>
          <ul className="space-y-2">
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Verify auth context (Clerk userId) is available in tRPC procedures
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
