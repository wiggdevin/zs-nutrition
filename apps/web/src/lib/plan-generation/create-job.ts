import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

/**
 * Build the intakeData object from an active user profile.
 */
export function buildIntakeData(activeProfile: {
  name: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goalType: string;
  goalRate: number;
  activityLevel: string;
  dietaryStyle: string;
  macroStyle: string;
  mealsPerDay: number;
  snacksPerDay: number;
  allergies: unknown;
  exclusions: unknown;
  cuisinePrefs: unknown;
  trainingDays: unknown;
  trainingTime: string | null;
  cookingSkill: number | null;
  prepTimeMax: number | null;
  bodyFatPercent: number | null;
}) {
  const allergies = (
    Array.isArray(activeProfile.allergies) ? activeProfile.allergies : []
  ) as string[];
  const exclusions = (
    Array.isArray(activeProfile.exclusions) ? activeProfile.exclusions : []
  ) as string[];

  return {
    intakeData: {
      name: activeProfile.name,
      sex: activeProfile.sex,
      age: activeProfile.age,
      heightCm: activeProfile.heightCm,
      weightKg: activeProfile.weightKg,
      goalType: activeProfile.goalType,
      goalRate: activeProfile.goalRate,
      activityLevel: activeProfile.activityLevel,
      dietaryStyle: activeProfile.dietaryStyle,
      macroStyle: activeProfile.macroStyle,
      mealsPerDay: activeProfile.mealsPerDay,
      snacksPerDay: activeProfile.snacksPerDay,
      allergies,
      exclusions,
      cuisinePreferences: (Array.isArray(activeProfile.cuisinePrefs)
        ? activeProfile.cuisinePrefs
        : []) as string[],
      trainingDays: (Array.isArray(activeProfile.trainingDays)
        ? activeProfile.trainingDays
        : []) as string[],
      trainingTime: activeProfile.trainingTime || undefined,
      cookingSkill: activeProfile.cookingSkill || 5,
      prepTimeMaxMin: activeProfile.prepTimeMax || 30,
      bodyFatPercent: activeProfile.bodyFatPercent || undefined,
      planDurationDays: 7,
    },
    allergies,
    exclusions,
  };
}

/**
 * Check for an existing pending/running job to prevent duplicates.
 * Returns the existing job response or null.
 */
export async function checkExistingJob(userId: string): Promise<NextResponse | null> {
  const existingJob = await prisma.planGenerationJob.findFirst({
    where: {
      userId,
      status: { in: ['pending', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingJob) {
    return NextResponse.json({
      success: true,
      jobId: existingJob.id,
      status: existingJob.status,
      existing: true,
    });
  }

  return null;
}

/**
 * Create a new plan generation job record in the database.
 */
export async function createPlanGenerationJob(userId: string, intakeData: Prisma.InputJsonValue) {
  const jobId = uuidv4();
  const job = await prisma.planGenerationJob.create({
    data: {
      id: jobId,
      userId,
      status: 'pending',
      intakeData,
    },
  });

  return job;
}
