'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      name: 'zsn-user-store', // localStorage key
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
