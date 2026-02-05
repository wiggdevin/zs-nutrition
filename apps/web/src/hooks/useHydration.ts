import { useEffect, useState } from 'react';

/**
 * Hook to detect when client-side hydration has completed.
 *
 * This is useful for avoiding SSR hydration mismatches when rendering
 * content that depends on client-only state (e.g., localStorage, Zustand stores).
 *
 * @returns {boolean} - Returns false during SSR and initial render, true after hydration
 *
 * @example
 * ```tsx
 * const hydrated = useHydration()
 *
 * if (!hydrated) {
 *   return <Skeleton />
 * }
 *
 * return <ClientOnlyContent />
 * ```
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
