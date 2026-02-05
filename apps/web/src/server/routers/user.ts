import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { safeJsonParse } from '@/lib/utils/safe-json';
import { StepDataSchema } from '@/lib/schemas/plan';

export const userRouter = router({
  getOnboardingState: protectedProcedure.query(async ({ ctx }) => {
    const dbUserId = ctx.dbUserId;
    const state = await ctx.prisma.onboardingState.findUnique({
      where: { userId: dbUserId },
    });
    return state;
  }),

  updateOnboardingStep: protectedProcedure
    .input(
      z.object({
        step: z.number().min(1).max(6),
        data: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbUserId = ctx.dbUserId;
      const existing = await ctx.prisma.onboardingState.findUnique({
        where: { userId: dbUserId },
      });

      // Merge step data
      const existingData = safeJsonParse(existing?.stepData, StepDataSchema, {});
      const mergedData = { ...existingData, ...input.data };

      if (existing) {
        return ctx.prisma.onboardingState.update({
          where: { userId: dbUserId },
          data: {
            currentStep: input.step,
            stepData: JSON.stringify(mergedData),
          },
        });
      }

      return ctx.prisma.onboardingState.create({
        data: {
          userId: dbUserId,
          currentStep: input.step,
          stepData: JSON.stringify(mergedData),
        },
      });
    }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        sex: z.enum(['male', 'female']),
        age: z.number().min(18).max(100),
        heightCm: z.number().min(100).max(250),
        weightKg: z.number().min(30).max(300),
        bodyFatPercent: z.number().min(3).max(60).optional(),
        goalType: z.enum(['cut', 'maintain', 'bulk']),
        goalRate: z.number().min(0).max(2),
        activityLevel: z.enum([
          'sedentary',
          'lightly_active',
          'moderately_active',
          'very_active',
          'extremely_active',
        ]),
        trainingDays: z.array(z.string()),
        dietaryStyle: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo']),
        allergies: z.array(z.string()),
        exclusions: z.array(z.string()),
        cuisinePreferences: z.array(z.string()),
        mealsPerDay: z.number().min(2).max(6),
        snacksPerDay: z.number().min(0).max(4),
        cookingSkill: z.number().min(1).max(10),
        prepTimeMax: z.number().min(10).max(120),
        macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbUserId = ctx.dbUserId;

      // Calculate metabolic profile
      const bmr =
        input.sex === 'male'
          ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
          : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

      const activityMultipliers: Record<string, number> = {
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
        extremely_active: 1.9,
      };
      const tdee = Math.round(bmr * activityMultipliers[input.activityLevel]);

      let goalKcal = tdee;
      if (input.goalType === 'cut') goalKcal = tdee - input.goalRate * 500;
      if (input.goalType === 'bulk') goalKcal = tdee + input.goalRate * 350;
      goalKcal = Math.round(goalKcal);

      const macroSplits: Record<string, { p: number; c: number; f: number }> = {
        balanced: { p: 0.3, c: 0.4, f: 0.3 },
        high_protein: { p: 0.4, c: 0.35, f: 0.25 },
        low_carb: { p: 0.35, c: 0.25, f: 0.4 },
        keto: { p: 0.3, c: 0.05, f: 0.65 },
      };
      const split = macroSplits[input.macroStyle];
      const proteinG = Math.round((goalKcal * split.p) / 4);
      const carbsG = Math.round((goalKcal * split.c) / 4);
      const fatG = Math.round((goalKcal * split.f) / 9);

      // Create user profile
      const profile = await ctx.prisma.userProfile.create({
        data: {
          userId: dbUserId,
          name: input.name,
          sex: input.sex,
          age: input.age,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          bodyFatPercent: input.bodyFatPercent,
          goalType: input.goalType,
          goalRate: input.goalRate,
          activityLevel: input.activityLevel,
          dietaryStyle: input.dietaryStyle,
          allergies: JSON.stringify(input.allergies),
          exclusions: JSON.stringify(input.exclusions),
          cuisinePrefs: JSON.stringify(input.cuisinePreferences),
          trainingDays: JSON.stringify(input.trainingDays),
          mealsPerDay: input.mealsPerDay,
          snacksPerDay: input.snacksPerDay,
          cookingSkill: input.cookingSkill,
          prepTimeMax: input.prepTimeMax,
          macroStyle: input.macroStyle,
          bmrKcal: Math.round(bmr),
          tdeeKcal: tdee,
          goalKcal,
          proteinTargetG: proteinG,
          carbsTargetG: carbsG,
          fatTargetG: fatG,
          isActive: true,
        },
      });

      // Mark onboarding complete
      await ctx.prisma.onboardingState.upsert({
        where: { userId: dbUserId },
        update: { completed: true, currentStep: 6 },
        create: {
          userId: dbUserId,
          completed: true,
          currentStep: 6,
        },
      });

      return { profile, redirectTo: '/generate' };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const dbUserId = ctx.dbUserId;
    const profile = await ctx.prisma.userProfile.findFirst({
      where: { userId: dbUserId, isActive: true },
    });
    return profile;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
        age: z
          .number()
          .int('Age must be a whole number')
          .min(18, 'Must be at least 18 years old')
          .max(100, 'Age must be 100 or less'),
        heightCm: z
          .number()
          .min(100, 'Height must be at least 100 cm')
          .max(250, 'Height must be 250 cm or less'),
        weightKg: z
          .number()
          .min(30, 'Weight must be at least 30 kg')
          .max(300, 'Weight must be 300 kg or less'),
        bodyFatPercent: z
          .number()
          .min(3, 'Body fat must be at least 3%')
          .max(60, 'Body fat must be 60% or less')
          .optional(),
        goalType: z.enum(['cut', 'maintain', 'bulk'], {
          errorMap: () => ({ message: 'Goal type must be cut, maintain, or bulk' }),
        }),
        goalRate: z
          .number()
          .min(0, 'Goal rate must be non-negative')
          .max(2, 'Goal rate must be 2 or less'),
        activityLevel: z.enum(
          ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
          { errorMap: () => ({ message: 'Invalid activity level' }) }
        ),
        dietaryStyle: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo'], {
          errorMap: () => ({ message: 'Invalid dietary style' }),
        }),
        mealsPerDay: z
          .number()
          .int()
          .min(2, 'Meals per day must be at least 2')
          .max(6, 'Meals per day must be 6 or less'),
        snacksPerDay: z
          .number()
          .int()
          .min(0, 'Snacks per day cannot be negative')
          .max(4, 'Snacks per day must be 4 or less'),
        cookingSkill: z
          .number()
          .int()
          .min(1, 'Cooking skill must be at least 1')
          .max(10, 'Cooking skill must be 10 or less'),
        prepTimeMax: z
          .number()
          .int()
          .min(10, 'Prep time must be at least 10 minutes')
          .max(120, 'Prep time must be 120 minutes or less'),
        macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto'], {
          errorMap: () => ({ message: 'Invalid macro style' }),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbUserId = ctx.dbUserId;

      // Find existing active profile
      const existing = await ctx.prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active profile found. Please complete onboarding first.',
        });
      }

      // Recalculate metabolic profile
      const bmr =
        existing.sex === 'male'
          ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
          : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

      const activityMultipliers: Record<string, number> = {
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
        extremely_active: 1.9,
      };
      const tdee = Math.round(bmr * activityMultipliers[input.activityLevel]);

      let goalKcal = tdee;
      if (input.goalType === 'cut') goalKcal = tdee - input.goalRate * 500;
      if (input.goalType === 'bulk') goalKcal = tdee + input.goalRate * 350;
      goalKcal = Math.round(goalKcal);

      const macroSplits: Record<string, { p: number; c: number; f: number }> = {
        balanced: { p: 0.3, c: 0.4, f: 0.3 },
        high_protein: { p: 0.4, c: 0.35, f: 0.25 },
        low_carb: { p: 0.35, c: 0.25, f: 0.4 },
        keto: { p: 0.3, c: 0.05, f: 0.65 },
      };
      const split = macroSplits[input.macroStyle];
      const proteinG = Math.round((goalKcal * split.p) / 4);
      const carbsG = Math.round((goalKcal * split.c) / 4);
      const fatG = Math.round((goalKcal * split.f) / 9);

      // Update profile
      const updated = await ctx.prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          age: input.age,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          bodyFatPercent: input.bodyFatPercent ?? null,
          goalType: input.goalType,
          goalRate: input.goalRate,
          activityLevel: input.activityLevel,
          dietaryStyle: input.dietaryStyle,
          mealsPerDay: input.mealsPerDay,
          snacksPerDay: input.snacksPerDay,
          cookingSkill: input.cookingSkill,
          prepTimeMax: input.prepTimeMax,
          macroStyle: input.macroStyle,
          bmrKcal: Math.round(bmr),
          tdeeKcal: tdee,
          goalKcal,
          proteinTargetG: proteinG,
          carbsTargetG: carbsG,
          fatTargetG: fatG,
        },
      });

      return { profile: updated };
    }),
});
