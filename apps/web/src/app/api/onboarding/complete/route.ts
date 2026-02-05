import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateMetabolicProfile } from '@/lib/metabolic';
import { requireActiveUser } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { profileSchemas, validateMealsPerDay, validateSnacksPerDay, validateCookingSkill, validatePrepTimeMax } from '@/lib/validation';
import { ZodError } from 'zod';

// POST - Complete onboarding, create UserProfile
export async function POST(request: NextRequest) {
  try {
    let clerkUserId: string
    let dbUserId: string
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Account is deactivated' ? 403 : 401
      return NextResponse.json({ error: message }, { status })
    }

    // In dev mode, accept profile data directly from request body
    let profileData: Record<string, unknown> | null = null;
    try {
      const body = await request.json();
      if (body && body.profileData) {
        profileData = body.profileData;
      }
    } catch {
      // No body or invalid JSON, fall back to onboarding state
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: { onboarding: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email: `${clerkUserId}@dev.local`,
        },
        include: { onboarding: true },
      });
    }

    // Get step data from profileData (request body) or onboarding state
    let stepData: Record<string, unknown>;
    if (profileData) {
      stepData = profileData;
    } else if (user.onboarding?.stepData) {
      stepData = JSON.parse(user.onboarding.stepData);
    } else {
      return NextResponse.json({ error: 'No profile data available' }, { status: 400 });
    }

    // Comprehensive server-side validation using Zod schema
    try {
      // Normalize step data to match onboarding schema structure
      const normalizedData = {
        name: stepData.name || 'User',
        sex: stepData.sex || 'male',
        age: Number(stepData.age) || 25,
        heightCm: stepData.heightCm ? Number(stepData.heightCm) : 170,
        weightKg: stepData.weightKg ? Number(stepData.weightKg) : 70,
        bodyFatPercent: stepData.bodyFatPercent ? Number(stepData.bodyFatPercent) : null,
        goalType: stepData.goalType || 'maintain',
        goalRate: Number(stepData.goalRate) || 1,
        activityLevel: stepData.activityLevel || 'moderately_active',
        trainingDays: Array.isArray(stepData.trainingDays) ? stepData.trainingDays : [],
        trainingTime: stepData.trainingTime || null,
        dietaryStyle: stepData.dietaryStyle || 'omnivore',
        allergies: Array.isArray(stepData.allergies) ? stepData.allergies : [],
        exclusions: Array.isArray(stepData.exclusions) ? stepData.exclusions : [],
        cuisinePreferences: Array.isArray(stepData.cuisinePreferences) ? stepData.cuisinePreferences : [],
        mealsPerDay: Number(stepData.mealsPerDay) || 3,
        snacksPerDay: Number(stepData.snacksPerDay) || 1,
        cookingSkill: Number(stepData.cookingSkill) || 5,
        prepTimeMax: Number(stepData.prepTimeMax) || 30,
        macroStyle: stepData.macroStyle || 'balanced',
      };

      // Validate against the onboarding schema
      profileSchemas.onboarding.parse(normalizedData);

      // If validation passes, use normalized values
      Object.assign(stepData, normalizedData);
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        return NextResponse.json(
          { error: 'Validation failed', errors },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    // Convert imperial to metric (or use metric values directly)
    const heightFeet = Number(stepData.heightFeet) || 0;
    const heightInches = Number(stepData.heightInches) || 0;
    const directHeightCm = Number(stepData.heightCm) || 0;
    const heightCm = directHeightCm > 0
      ? directHeightCm
      : heightFeet > 0
        ? ((heightFeet * 12) + heightInches) * 2.54
        : 170;

    const weightLbs = Number(stepData.weightLbs) || 0;
    const directWeightKg = Number(stepData.weightKg) || 0;
    const weightKg = directWeightKg > 0
      ? directWeightKg
      : weightLbs > 0
        ? weightLbs * 0.453592
        : 70;

    // Calculate metabolic profile
    const metabolic = calculateMetabolicProfile({
      sex: (stepData.sex as string) || 'male',
      age: Number(stepData.age) || 25,
      heightCm,
      weightKg,
      activityLevel: (stepData.activityLevel as string) || 'moderately_active',
      goalType: (stepData.goalType as string) || 'maintain',
      goalRate: Number(stepData.goalRate) || 1,
      macroStyle: (stepData.macroStyle as string) || 'balanced',
    });

    // Check for existing active profile (idempotency guard against double-submit)
    const existingProfile = await prisma.userProfile.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (existingProfile) {
      // Profile already exists — return it without creating a duplicate
      // Clean up onboarding state by deleting it
      if (user.onboarding) {
        await prisma.onboardingState.delete({
          where: { id: user.onboarding.id },
        });
      }
      return NextResponse.json({
        success: true,
        profile: existingProfile,
        metabolic: {
          bmrKcal: existingProfile.bmrKcal,
          tdeeKcal: existingProfile.tdeeKcal,
          goalKcal: existingProfile.goalKcal,
          proteinTargetG: existingProfile.proteinTargetG,
          carbsTargetG: existingProfile.carbsTargetG,
          fatTargetG: existingProfile.fatTargetG,
        },
      });
    }

    // Create UserProfile
    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        name: (stepData.name as string) || 'User',
        sex: (stepData.sex as string) || 'male',
        age: Number(stepData.age) || 25,
        heightCm,
        weightKg,
        bodyFatPercent: stepData.bodyFatPercent ? Number(stepData.bodyFatPercent) : null,
        goalType: (stepData.goalType as string) || 'maintain',
        goalRate: Number(stepData.goalRate) || 1,
        activityLevel: (stepData.activityLevel as string) || 'moderately_active',
        dietaryStyle: (stepData.dietaryStyle as string) || 'omnivore',
        allergies: JSON.stringify(stepData.allergies || []),
        exclusions: JSON.stringify(stepData.exclusions || []),
        cuisinePrefs: JSON.stringify(stepData.cuisinePreferences || []),
        trainingDays: JSON.stringify(stepData.trainingDays || []),
        trainingTime: (stepData.trainingTime as string) || null,
        mealsPerDay: Number(stepData.mealsPerDay) || 3,
        snacksPerDay: Number(stepData.snacksPerDay) || 1,
        cookingSkill: Number(stepData.cookingSkill) || 5,
        prepTimeMax: Number(stepData.prepTimeMax) || 30,
        macroStyle: (stepData.macroStyle as string) || 'balanced',
        bmrKcal: metabolic.bmrKcal,
        tdeeKcal: metabolic.tdeeKcal,
        goalKcal: metabolic.goalKcal,
        proteinTargetG: metabolic.proteinTargetG,
        carbsTargetG: metabolic.carbsTargetG,
        fatTargetG: metabolic.fatTargetG,
        isActive: true,
      },
    });

    // Clean up onboarding state by deleting it (profile creation is the permanent record)
    if (user.onboarding) {
      await prisma.onboardingState.delete({
        where: { id: user.onboarding.id },
      });
    }
    // If onboarding state doesn't exist for some reason, no action needed

    return NextResponse.json({
      success: true,
      profile,
      metabolic,
    });
  } catch (error) {
    logger.error('Onboarding complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
