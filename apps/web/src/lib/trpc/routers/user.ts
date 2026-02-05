import { z } from 'zod';
import { router, protectedProcedure } from '../server';

export const userRouter = router({
  getOnboardingState: protectedProcedure.query(async ({ ctx }) => {
    const state = await ctx.prisma.onboardingState.findUnique({
      where: { userId: ctx.userId },
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
      const existing = await ctx.prisma.onboardingState.findUnique({
        where: { userId: ctx.userId },
      });

      // Merge step data
      const existingData = existing?.stepData ? JSON.parse(existing.stepData) : {};
      const mergedData = { ...existingData, ...input.data };

      if (existing) {
        return ctx.prisma.onboardingState.update({
          where: { userId: ctx.userId },
          data: {
            currentStep: input.step,
            stepData: JSON.stringify(mergedData),
          },
        });
      }

      return ctx.prisma.onboardingState.create({
        data: {
          userId: ctx.userId,
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
          userId: ctx.userId,
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
        where: { userId: ctx.userId },
        update: { completed: true, currentStep: 6 },
        create: {
          userId: ctx.userId,
          completed: true,
          currentStep: 6,
        },
      });

      return { profile, redirectTo: '/generate' };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.userProfile.findFirst({
      where: { userId: ctx.userId, isActive: true },
    });
    return profile;
  }),
});
