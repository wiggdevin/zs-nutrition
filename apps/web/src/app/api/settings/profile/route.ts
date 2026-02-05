import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveUser } from '@/lib/auth';
import { calculateMetabolicProfile } from '@/lib/metabolic';
import { logger } from '@/lib/safe-logger';
import { profileUpdateSchema } from '@/lib/validation';
import { ZodError } from 'zod';

// GET - fetch user profile for settings
export async function GET() {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        profiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = user.profiles[0] || null;

    if (!profile) {
      return NextResponse.json(
        { error: 'No profile found. Complete onboarding first.' },
        { status: 404 }
      );
    }

    // Parse JSON fields safely
    let allergies: string[] = [];
    let exclusions: string[] = [];
    let cuisinePrefs: string[] = [];
    let trainingDays: string[] = [];

    try {
      allergies = JSON.parse(profile.allergies);
    } catch {
      allergies = [];
    }
    try {
      exclusions = JSON.parse(profile.exclusions);
    } catch {
      exclusions = [];
    }
    try {
      cuisinePrefs = JSON.parse(profile.cuisinePrefs);
    } catch {
      cuisinePrefs = [];
    }
    try {
      trainingDays = JSON.parse(profile.trainingDays);
    } catch {
      trainingDays = [];
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        name: profile.name,
        sex: profile.sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatPercent: profile.bodyFatPercent,
        goalType: profile.goalType,
        goalRate: profile.goalRate,
        activityLevel: profile.activityLevel,
        dietaryStyle: profile.dietaryStyle,
        allergies,
        exclusions,
        cuisinePrefs,
        trainingDays,
        mealsPerDay: profile.mealsPerDay,
        snacksPerDay: profile.snacksPerDay,
        cookingSkill: profile.cookingSkill,
        prepTimeMax: profile.prepTimeMax,
        macroStyle: profile.macroStyle,
      },
    });
  } catch (error) {
    logger.error('Settings profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - update user profile (all sections)
export async function PUT(request: NextRequest) {
  try {
    let clerkUserId: string;
    let dbUserId: string;
    try {
      ({ clerkUserId, dbUserId } = await requireActiveUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      const status = message === 'Account is deactivated' ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Validate using comprehensive Zod schema
    let validatedData: any;
    try {
      // Parse and validate the request body
      validatedData = profileUpdateSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
      }
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        profiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = user.profiles[0];
    if (!profile) {
      return NextResponse.json(
        { error: 'No profile found. Complete onboarding first.' },
        { status: 404 }
      );
    }

    // Build update data - only include fields that were provided (already validated)
    const updateData: Record<string, unknown> = {};

    // Demographics
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.sex !== undefined) updateData.sex = validatedData.sex;
    if (validatedData.age !== undefined) updateData.age = validatedData.age;
    if (validatedData.heightCm !== undefined) updateData.heightCm = validatedData.heightCm;
    if (validatedData.weightKg !== undefined) updateData.weightKg = validatedData.weightKg;
    if (validatedData.bodyFatPercent !== undefined)
      updateData.bodyFatPercent = validatedData.bodyFatPercent;

    // Goals
    if (validatedData.goalType !== undefined) updateData.goalType = validatedData.goalType;
    if (validatedData.goalRate !== undefined) updateData.goalRate = validatedData.goalRate;

    // Dietary
    if (validatedData.dietaryStyle !== undefined)
      updateData.dietaryStyle = validatedData.dietaryStyle;
    if (validatedData.allergies !== undefined)
      updateData.allergies = JSON.stringify(validatedData.allergies);
    if (validatedData.exclusions !== undefined)
      updateData.exclusions = JSON.stringify(validatedData.exclusions);

    // Activity
    if (validatedData.activityLevel !== undefined)
      updateData.activityLevel = validatedData.activityLevel;
    if (validatedData.trainingDays !== undefined)
      updateData.trainingDays = JSON.stringify(validatedData.trainingDays);
    if (validatedData.trainingTime !== undefined)
      updateData.trainingTime = validatedData.trainingTime;
    if (validatedData.cookingSkill !== undefined)
      updateData.cookingSkill = validatedData.cookingSkill;
    if (validatedData.prepTimeMax !== undefined) updateData.prepTimeMax = validatedData.prepTimeMax;

    // Meal structure
    if (validatedData.macroStyle !== undefined) updateData.macroStyle = validatedData.macroStyle;
    if (validatedData.cuisinePrefs !== undefined)
      updateData.cuisinePrefs = JSON.stringify(validatedData.cuisinePrefs);
    if (validatedData.mealsPerDay !== undefined) updateData.mealsPerDay = validatedData.mealsPerDay;
    if (validatedData.snacksPerDay !== undefined)
      updateData.snacksPerDay = validatedData.snacksPerDay;

    // First update the profile with the provided fields
    let updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    // Recalculate metabolic values if any demographic/goal/activity field changed
    const metabolicFields = [
      'sex',
      'age',
      'heightCm',
      'weightKg',
      'activityLevel',
      'goalType',
      'goalRate',
      'macroStyle',
    ];
    const metabolicChanged = metabolicFields.some((f) => validatedData[f] !== undefined);

    if (metabolicChanged) {
      const metabolic = calculateMetabolicProfile({
        sex: updatedProfile.sex,
        age: updatedProfile.age,
        heightCm: updatedProfile.heightCm,
        weightKg: updatedProfile.weightKg,
        activityLevel: updatedProfile.activityLevel,
        goalType: updatedProfile.goalType,
        goalRate: updatedProfile.goalRate ?? 1,
        macroStyle: updatedProfile.macroStyle || 'balanced',
      });

      updatedProfile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          bmrKcal: metabolic.bmrKcal,
          tdeeKcal: metabolic.tdeeKcal,
          goalKcal: metabolic.goalKcal,
          proteinTargetG: metabolic.proteinTargetG,
          carbsTargetG: metabolic.carbsTargetG,
          fatTargetG: metabolic.fatTargetG,
        },
      });
    }

    return NextResponse.json({
      success: true,
      metabolicRecalculated: metabolicChanged,
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        sex: updatedProfile.sex,
        age: updatedProfile.age,
        heightCm: updatedProfile.heightCm,
        weightKg: updatedProfile.weightKg,
        bodyFatPercent: updatedProfile.bodyFatPercent,
        goalType: updatedProfile.goalType,
        goalRate: updatedProfile.goalRate,
        activityLevel: updatedProfile.activityLevel,
        dietaryStyle: updatedProfile.dietaryStyle,
        bmrKcal: updatedProfile.bmrKcal,
        tdeeKcal: updatedProfile.tdeeKcal,
        goalKcal: updatedProfile.goalKcal,
        proteinTargetG: updatedProfile.proteinTargetG,
        carbsTargetG: updatedProfile.carbsTargetG,
        fatTargetG: updatedProfile.fatTargetG,
      },
    });
  } catch (error) {
    logger.error('Settings profile PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
