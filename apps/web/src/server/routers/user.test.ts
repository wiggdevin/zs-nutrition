import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createCaller, createAuthedTestContext } from '@/test/trpc-test-utils';

// Mock metabolic utilities
vi.mock('@/lib/metabolic-utils', () => ({
  calculateBMR: vi.fn(() => 1800),
  calculateTDEE: vi.fn(() => 2500),
  calculateGoalCalories: vi.fn(() => 2000),
  calculateMacroTargets: vi.fn(() => ({
    proteinG: 150,
    carbsG: 200,
    fatG: 65,
  })),
}));

describe('user router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnboardingState', () => {
    it('returns null when no onboarding state exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-new' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.onboardingState.findUnique).mockResolvedValue(null);

      const result = await caller.user.getOnboardingState();

      expect(result).toBeNull();
      expect(prisma.onboardingState.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-new' },
      });
    });

    it('returns onboarding state when it exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockState = {
        id: 'state-123',
        userId: 'user-123',
        currentStep: 3,
        completed: false,
        stepData: {
          step1: { name: 'John', age: 30 },
          step2: { heightCm: 180, weightKg: 80 },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.onboardingState.findUnique).mockResolvedValue(mockState);

      const result = await caller.user.getOnboardingState();

      expect(result).toBeTruthy();
      expect(result?.currentStep).toBe(3);
      expect(result?.completed).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('creates a user profile and marks onboarding complete', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        name: 'John Doe',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        bodyFatPercent: null,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePrefs: [],
        trainingDays: ['monday', 'wednesday', 'friday'],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 45,
        macroStyle: 'balanced',
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOnboardingState = {
        id: 'state-123',
        userId: 'user-123',
        currentStep: 6,
        completed: true,
        stepData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userProfile.create).mockResolvedValue(mockProfile);
      vi.mocked(prisma.onboardingState.upsert).mockResolvedValue(mockOnboardingState);

      const result = await caller.user.completeOnboarding({
        name: 'John Doe',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        trainingDays: ['monday', 'wednesday', 'friday'],
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePreferences: [],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 45,
        macroStyle: 'balanced',
      });

      expect(result.profile.name).toBe('John Doe');
      expect(result.profile.isActive).toBe(true);
      expect(result.redirectTo).toBe('/generate');
      expect(prisma.userProfile.create).toHaveBeenCalled();
      expect(prisma.onboardingState.upsert).toHaveBeenCalled();
    });

    it('calculates metabolic values correctly', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-456' });
      const caller = createCaller(ctx);

      const mockProfile = {
        id: 'profile-456',
        userId: 'user-456',
        name: 'Jane Smith',
        sex: 'female',
        age: 25,
        heightCm: 165,
        weightKg: 60,
        bodyFatPercent: 20,
        goalType: 'cut',
        goalRate: 0.5,
        activityLevel: 'lightly_active',
        dietaryStyle: 'vegetarian',
        allergies: ['peanuts'],
        exclusions: ['beef', 'pork'],
        cuisinePrefs: ['italian', 'mediterranean'],
        trainingDays: ['tuesday', 'thursday', 'saturday'],
        mealsPerDay: 4,
        snacksPerDay: 2,
        cookingSkill: 7,
        prepTimeMax: 60,
        macroStyle: 'high_protein',
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userProfile.create).mockResolvedValue(mockProfile);
      vi.mocked(prisma.onboardingState.upsert).mockResolvedValue({
        id: 'state-456',
        userId: 'user-456',
        currentStep: 6,
        completed: true,
        stepData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { calculateBMR, calculateTDEE, calculateGoalCalories, calculateMacroTargets } =
        await import('@/lib/metabolic-utils');

      await caller.user.completeOnboarding({
        name: 'Jane Smith',
        sex: 'female',
        age: 25,
        heightCm: 165,
        weightKg: 60,
        bodyFatPercent: 20,
        goalType: 'cut',
        goalRate: 0.5,
        activityLevel: 'lightly_active',
        trainingDays: ['tuesday', 'thursday', 'saturday'],
        dietaryStyle: 'vegetarian',
        allergies: ['peanuts'],
        exclusions: ['beef', 'pork'],
        cuisinePreferences: ['italian', 'mediterranean'],
        mealsPerDay: 4,
        snacksPerDay: 2,
        cookingSkill: 7,
        prepTimeMax: 60,
        macroStyle: 'high_protein',
      });

      expect(calculateBMR).toHaveBeenCalledWith({
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        age: 25,
      });
      expect(calculateTDEE).toHaveBeenCalledWith(1800, 'lightly_active');
      expect(calculateGoalCalories).toHaveBeenCalledWith(2500, 'cut', 0.5);
      expect(calculateMacroTargets).toHaveBeenCalledWith(2000, 'high_protein');
    });
  });

  describe('getProfile', () => {
    it('returns null when no active profile exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-no-profile' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(null);

      const result = await caller.user.getProfile();

      expect(result).toBeNull();
      expect(prisma.userProfile.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-no-profile', isActive: true },
      });
    });

    it('returns the active profile', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        name: 'Test User',
        sex: 'male',
        age: 35,
        heightCm: 175,
        weightKg: 85,
        bodyFatPercent: 18,
        goalType: 'bulk',
        goalRate: 0.3,
        activityLevel: 'very_active',
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePrefs: ['asian', 'mexican'],
        trainingDays: ['monday', 'wednesday', 'friday', 'sunday'],
        mealsPerDay: 5,
        snacksPerDay: 2,
        cookingSkill: 6,
        prepTimeMax: 40,
        macroStyle: 'high_protein',
        bmrKcal: 1900,
        tdeeKcal: 2700,
        goalKcal: 2900,
        proteinTargetG: 180,
        carbsTargetG: 300,
        fatTargetG: 80,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(mockProfile);

      const result = await caller.user.getProfile();

      expect(result).toBeTruthy();
      expect(result?.name).toBe('Test User');
      expect(result?.goalType).toBe('bulk');
    });
  });

  describe('updateProfile', () => {
    it('throws NOT_FOUND when no active profile exists', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-no-profile' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(null);

      await expect(
        caller.user.updateProfile({
          name: 'Updated Name',
          age: 30,
          heightCm: 180,
          weightKg: 80,
          goalType: 'maintain',
          goalRate: 0,
          activityLevel: 'moderately_active',
          dietaryStyle: 'omnivore',
          mealsPerDay: 3,
          snacksPerDay: 1,
          cookingSkill: 5,
          prepTimeMax: 45,
          macroStyle: 'balanced',
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'No active profile found. Please complete onboarding first.',
      });
    });

    it('updates the profile and recalculates metabolic values', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const existingProfile = {
        id: 'profile-123',
        userId: 'user-123',
        name: 'Old Name',
        sex: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        bodyFatPercent: null,
        goalType: 'maintain',
        goalRate: 0,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        allergies: [],
        exclusions: [],
        cuisinePrefs: [],
        trainingDays: [],
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 45,
        macroStyle: 'balanced',
        bmrKcal: 1800,
        tdeeKcal: 2500,
        goalKcal: 2000,
        proteinTargetG: 150,
        carbsTargetG: 200,
        fatTargetG: 65,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProfile = {
        ...existingProfile,
        name: 'New Name',
        weightKg: 75,
        goalType: 'cut',
        goalRate: 0.5,
        bmrKcal: 1750,
        tdeeKcal: 2400,
        goalKcal: 1900,
        proteinTargetG: 160,
        carbsTargetG: 180,
        fatTargetG: 60,
      };

      vi.mocked(prisma.userProfile.findFirst).mockResolvedValue(existingProfile);
      vi.mocked(prisma.userProfile.update).mockResolvedValue(updatedProfile);

      const result = await caller.user.updateProfile({
        name: 'New Name',
        age: 30,
        heightCm: 180,
        weightKg: 75,
        goalType: 'cut',
        goalRate: 0.5,
        activityLevel: 'moderately_active',
        dietaryStyle: 'omnivore',
        mealsPerDay: 3,
        snacksPerDay: 1,
        cookingSkill: 5,
        prepTimeMax: 45,
        macroStyle: 'balanced',
      });

      expect(result.profile.name).toBe('New Name');
      expect(result.profile.weightKg).toBe(75);
      expect(prisma.userProfile.update).toHaveBeenCalled();
    });
  });

  describe('deactivateAccount', () => {
    it('throws NOT_FOUND when user does not exist', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-not-found' });
      const caller = createCaller(ctx);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(caller.user.deactivateAccount()).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    });

    it('throws BAD_REQUEST when account is already deactivated', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-deactivated' });
      const caller = createCaller(ctx);

      const deactivatedUser = {
        id: 'user-deactivated',
        clerkId: 'clerk-123',
        email: 'test@example.com',
        isActive: false,
        deactivatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(deactivatedUser);

      await expect(caller.user.deactivateAccount()).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Account is already deactivated',
      });
    });

    it('deactivates the user account and their meal plans', async () => {
      const ctx = createAuthedTestContext({ dbUserId: 'user-123' });
      const caller = createCaller(ctx);

      const activeUser = {
        id: 'user-123',
        clerkId: 'clerk-123',
        email: 'test@example.com',
        isActive: true,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...activeUser,
        isActive: false,
        deactivatedAt: new Date(),
      });
      vi.mocked(prisma.mealPlan.updateMany).mockResolvedValue({ count: 2 });

      const result = await caller.user.deactivateAccount();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Account deactivated successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      });
      expect(prisma.mealPlan.updateMany).toHaveBeenCalled();
    });
  });
});
