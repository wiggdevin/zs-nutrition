'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { safeStorage } from './storage';
import { logger } from '@/lib/safe-logger';

interface WaterState {
  dailyGoalMl: number;
  setDailyGoalMl: (goal: number) => void;
}

const waterPersistedSchema = z.object({
  dailyGoalMl: z.number().min(500).max(10000).catch(2500),
});

export const useWaterStore = create<WaterState>()(
  persist(
    (set) => ({
      dailyGoalMl: 2500,
      setDailyGoalMl: (goal) => set({ dailyGoalMl: goal }),
    }),
    {
      name: 'zsn-water-store',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        dailyGoalMl: state.dailyGoalMl,
      }),
      migrate: (persisted: unknown) => {
        const parsed = waterPersistedSchema.safeParse(persisted);
        if (!parsed.success) {
          logger.warn('[WaterStore] Migration failed, resetting to defaults:', parsed.error);
          return { dailyGoalMl: 2500 };
        }
        return parsed.data;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            logger.warn('[WaterStore] Rehydration error:', error);
          }
        };
      },
    }
  )
);
