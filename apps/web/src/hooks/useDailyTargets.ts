'use client';

import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useTrackingStore } from '@/lib/stores/useTrackingStore';

export function useDailyTargets() {
  const dayOfWeek = new Date().getDay();
  const query = trpc.user.getDailyTargets.useQuery({ dayOfWeek }, { staleTime: 60_000 });
  const utils = trpc.useUtils();

  const setTargets = useTrackingStore((s) => s.setTargets);
  useEffect(() => {
    if (query.data) {
      setTargets({
        calories: query.data.effectiveKcal,
        protein: query.data.proteinG,
        carbs: query.data.carbsG,
        fat: query.data.fatG,
      });
    }
  }, [query.data, setTargets]);

  const invalidate = () => utils.user.getDailyTargets.invalidate();

  return { ...query, invalidate };
}
