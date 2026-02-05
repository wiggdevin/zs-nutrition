'use client'

import { notFound } from 'next/navigation'
import { trpc } from '@/lib/trpc'

export default function TestFeature503Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  // Call the test procedure
  const { data, isLoading, error } = trpc.test.hello.useQuery({ name: 'Feature 503' })

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">tRPC v11 Setup Verification</h1>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Test Results:</h2>

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
              <div className="text-green-500 font-semibold">✅ tRPC is working!</div>

              <div className="bg-muted p-4 rounded space-y-2">
                <p><strong>Greeting:</strong> {data.greeting}</p>
                <p><strong>Timestamp:</strong> {data.timestamp}</p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>This confirms:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>tRPC server is configured correctly</li>
                  <li>tRPC client is configured correctly</li>
                  <li>Type-safe API communication is working</li>
                  <li>SuperJSON transformer is working</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Feature 503 Checklist:</h3>
          <ul className="space-y-2">
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Install @trpc/server, @trpc/client, @trpc/react-query, @trpc/next
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Install @tanstack/react-query as a peer dependency
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Create apps/web/lib/trpc/server.ts with tRPC initialization
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Create apps/web/lib/trpc/client.ts with tRPC client configuration
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Create apps/web/app/api/trpc/[trpc]/route.ts as the tRPC API handler
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Create a root appRouter in apps/web/lib/trpc/routers/_app.ts
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Create a test 'hello' procedure to verify the setup
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Set up TRPCProvider in root layout with QueryClientProvider
            </li>
            <li className={data ? 'text-green-500' : 'text-muted-foreground'}>
              {data ? '✅' : '⏳'} Verify tRPC procedure can be called from a client component
            </li>
            <li className="text-muted-foreground">
              ⏳ Verify auth context (Clerk userId) is available in tRPC procedures
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
