'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

/**
 * Layout wrapper that redirects deactivated users to /account-deactivated.
 * Uses staleTime to avoid hitting the DB on every navigation.
 */
export function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data } = trpc.account.getAccountStatus.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (data && !data.isActive) {
      router.replace('/account-deactivated');
    }
  }, [data, router]);

  if (data && !data.isActive) {
    return null;
  }

  return <>{children}</>;
}
