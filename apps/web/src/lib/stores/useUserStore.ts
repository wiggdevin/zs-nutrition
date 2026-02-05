'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { safeStorage } from './storage';
import { logger } from '@/lib/safe-logger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  sex: 'male' | 'female' | '';
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string;
  goalType: string;
  dietaryStyle: string;
  mealsPerDay: number;
}

export interface UserState {
  // ── Data ────────────────────────────────────────────────────────────────
  profile: UserProfile | null;
  isOnboarded: boolean;
  isLoading: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  clearProfile: () => void;
  setIsOnboarded: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  clearAllState: () => void; // Clears all state on sign-out
}

// ── Default values ─────────────────────────────────────────────────────────

const defaultProfile: UserProfile = {
  name: '',
  email: '',
  sex: '',
  age: null,
  heightCm: null,
  weightKg: null,
  activityLevel: '',
  goalType: '',
  dietaryStyle: '',
  mealsPerDay: 3,
};

// ── Persisted state schema ─────────────────────────────────────────────────

const userProfileSchema = z.object({
  name: z.string().catch(''),
  email: z.string().catch(''),
  sex: z.enum(['male', 'female', '']).catch(''),
  age: z.number().nullable().catch(null),
  heightCm: z.number().nullable().catch(null),
  weightKg: z.number().nullable().catch(null),
  activityLevel: z.string().catch(''),
  goalType: z.string().catch(''),
  dietaryStyle: z.string().catch(''),
  mealsPerDay: z.number().catch(3),
});

const userPersistedSchema = z.object({
  profile: userProfileSchema.nullable().catch(null),
  isOnboarded: z.boolean().catch(false),
});

// ── Store ──────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // Initial state
      profile: null,
      isOnboarded: false,
      isLoading: false,

      // Actions
      setProfile: (profile) => set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, ...partial }
            : { ...defaultProfile, ...partial },
        })),

      clearProfile: () => set({ profile: null, isOnboarded: false }),

      setIsOnboarded: (value) => set({ isOnboarded: value }),

      setIsLoading: (value) => set({ isLoading: value }),

      clearAllState: () => set({
        profile: null,
        isOnboarded: false,
        isLoading: false,
      }),
    }),
    {
      name: 'zsn-user-store',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
      }),
      migrate: (persisted: unknown) => {
        const parsed = userPersistedSchema.safeParse(persisted);
        if (!parsed.success) {
          logger.warn('[UserStore] Migration failed, resetting to defaults:', parsed.error);
          return {
            profile: null,
            isOnboarded: false,
          };
        }
        return parsed.data;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            logger.warn('[UserStore] Rehydration error:', error);
          }
        };
      },
    }
  )
);
