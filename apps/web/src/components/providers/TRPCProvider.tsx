'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { CACHE_TIMES } from '@/lib/query-cache-config';

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3456'}`;
}

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return false;
    if (code === 'BAD_REQUEST') return false;
    if (code === 'NOT_FOUND') return false;
  }
  return failureCount < 3;
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: CACHE_TIMES.ACTIVE_PLAN,
            refetchOnWindowFocus: false,
            retry: shouldRetry,
            retryDelay: (attemptIndex: number) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
          },
          mutations: {
            retry: (failureCount: number, error: unknown) => {
              if (failureCount >= 1) return false;
              return shouldRetry(failureCount, error);
            },
            retryDelay: 1000,
          },
        },
      })
  );

  const [trpcClient] = React.useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return { 'x-trpc-source': 'nextjs-react' };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
