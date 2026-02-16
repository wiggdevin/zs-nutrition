import { prisma } from '@/lib/prisma';
import { generatePlanPdf } from '@/lib/generate-plan-pdf';
import { uploadPlanPdf } from '@/lib/upload-pdf';
import { logger } from '@/lib/safe-logger';
import { toLocalDay, addDays } from '@/lib/date-utils';
import { isUniqueConstraintError } from '@/lib/plan-utils';

/**
 * Saves a completed plan generation result to the MealPlan table.
 * Called when a BullMQ job completes successfully.
 *
 * Handles:
 * 1. Looking up the PlanGenerationJob
 * 2. Finding the user's active profile (or creating a minimal one from intake data)
 * 3. Creating the MealPlan record with all denormalized fields
 * 4. Updating the PlanGenerationJob status to 'completed' with the planId
 * 5. Deactivating any previous active plans for the user
 */

export interface PlanCompletionData {
  jobId: string;
  planData: {
    days: Array<{
      dayNumber: number;
      dayName: string;
      isTrainingDay: boolean;
      targetKcal: number;
      meals: Array<{
        slot: string;
        name: string;
        cuisine?: string;
        prepTimeMin?: number;
        cookTimeMin?: number;
        nutrition: {
          kcal: number;
          proteinG: number;
          carbsG: number;
          fatG: number;
          fiberG?: number;
        };
        confidenceLevel?: string;
        ingredients?: Array<{
          name: string;
          amount: number | string;
          unit?: string;
          fatsecretFoodId?: string;
        }>;
        instructions?: string[];
      }>;
    }>;
    groceryList?: Array<{ category: string; items: string[] }>;
    qa?: {
      status: string;
      score: number;
      iterations?: number;
    };
    weeklyTotals?: {
      avgKcal: number;
      avgProteinG: number;
      avgCarbsG: number;
      avgFatG: number;
    };
  };
  metabolicProfile?: {
    bmrKcal?: number;
    tdeeKcal?: number;
    goalKcal?: number;
    proteinTargetG?: number;
    carbsTargetG?: number;
    fatTargetG?: number;
    trainingBonusKcal?: number;
  };
}

export interface SavePlanResult {
  success: boolean;
  planId?: string;
  error?: string;
}

export async function savePlanToDatabase(data: PlanCompletionData): Promise<SavePlanResult> {
  const { jobId, planData, metabolicProfile } = data;

  try {
    // 1. Look up the PlanGenerationJob to get userId and intake data
    const job = await prisma.planGenerationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return { success: false, error: `Job ${jobId} not found` };
    }

    if (job.status === 'completed') {
      // Idempotent - already completed, find the existing plan
      // result is now a Prisma Json type - no parsing needed
      const existingResult = job.result as { planId?: string } | null;
      return {
        success: true,
        planId: existingResult?.planId || undefined,
      };
    }

    const userId = job.userId;

    // 2. Find the user's active profile
    let profile = await prisma.userProfile.findFirst({
      where: { userId, isActive: true },
    });

    // If no active profile, create one from intake data
    // intakeData is now a Prisma Json type - no parsing needed
    if (!profile) {
      const intakeData = job.intakeData as Record<string, unknown>;

      profile = await prisma.userProfile.create({
        data: {
          userId,
          name: (intakeData.name as string) || 'User',
          sex: (intakeData.sex as string) || 'male',
          age: (intakeData.age as number) || 30,
          heightCm:
            (intakeData.heightCm as number) ||
            (intakeData.heightFeet
              ? (intakeData.heightFeet as number) * 30.48 +
                ((intakeData.heightInches as number) || 0) * 2.54
              : 175),
          weightKg:
            (intakeData.weightKg as number) ||
            (intakeData.weightLbs ? (intakeData.weightLbs as number) * 0.4536 : 80),
          bodyFatPercent: (intakeData.bodyFatPercent as number) || null,
          goalType: (intakeData.goalType as string) || 'maintain',
          goalRate: (intakeData.goalRate as number) || 0,
          activityLevel: (intakeData.activityLevel as string) || 'moderately_active',
          dietaryStyle: (intakeData.dietaryStyle as string) || 'omnivore',
          // Json fields accept arrays directly
          allergies: intakeData.allergies || [],
          exclusions: intakeData.exclusions || [],
          cuisinePrefs: intakeData.cuisinePreferences || [],
          trainingDays: intakeData.trainingDays || [],
          trainingTime: (intakeData.trainingTime as string) || null,
          mealsPerDay: (intakeData.mealsPerDay as number) || 3,
          snacksPerDay: (intakeData.snacksPerDay as number) || 1,
          cookingSkill: (intakeData.cookingSkill as number) || 5,
          prepTimeMax: (intakeData.prepTimeMaxMin as number) || 30,
          macroStyle: (intakeData.macroStyle as string) || 'balanced',
          bmrKcal: metabolicProfile?.bmrKcal || null,
          tdeeKcal: metabolicProfile?.tdeeKcal || null,
          goalKcal: metabolicProfile?.goalKcal || null,
          proteinTargetG: metabolicProfile?.proteinTargetG || null,
          carbsTargetG: metabolicProfile?.carbsTargetG || null,
          fatTargetG: metabolicProfile?.fatTargetG || null,
          isActive: true,
        },
      });
    }

    // 3. Extract denormalized fields from plan data and metabolic profile
    const dailyKcalTarget =
      metabolicProfile?.goalKcal ||
      planData.weeklyTotals?.avgKcal ||
      planData.days[0]?.targetKcal ||
      null;

    const dailyProteinG =
      metabolicProfile?.proteinTargetG || planData.weeklyTotals?.avgProteinG || null;

    const dailyCarbsG = metabolicProfile?.carbsTargetG || planData.weeklyTotals?.avgCarbsG || null;

    const dailyFatG = metabolicProfile?.fatTargetG || planData.weeklyTotals?.avgFatG || null;

    const qaScore = planData.qa?.score || null;
    const qaStatus = planData.qa?.status || null;

    // Calculate start and end dates using proper timezone-safe utilities
    const startDate = toLocalDay(new Date());
    const planDays = planData.days?.length || 7;
    const endDate = addDays(startDate, planDays);

    // 4. Deactivate old plans and create new plan atomically in a transaction
    // This prevents race conditions where plans could be left in an inconsistent state
    // The partial unique index (MealPlan_userId_active_unique) enforces only one active plan per user
    let mealPlan;
    try {
      mealPlan = await prisma.$transaction(async (tx) => {
        // Step 1: Deactivate any existing active plans for this user (only non-deleted ones)
        await tx.mealPlan.updateMany({
          where: { userId, isActive: true, deletedAt: null },
          data: { isActive: false, status: 'replaced' },
        });

        // Step 2: Create the MealPlan record (atomic with step 1)
        // validatedPlan and metabolicProfile are now Prisma Json types - pass objects directly
        return tx.mealPlan.create({
          data: {
            userId,
            profileId: profile.id,
            validatedPlan: planData,
            metabolicProfile: metabolicProfile || {},
            dailyKcalTarget: dailyKcalTarget ? Math.round(dailyKcalTarget) : null,
            dailyProteinG: dailyProteinG ? Math.round(dailyProteinG) : null,
            dailyCarbsG: dailyCarbsG ? Math.round(dailyCarbsG) : null,
            dailyFatG: dailyFatG ? Math.round(dailyFatG) : null,
            trainingBonusKcal: metabolicProfile?.trainingBonusKcal
              ? Math.round(metabolicProfile.trainingBonusKcal)
              : null,
            planDays,
            startDate,
            endDate,
            qaScore: qaScore ? Math.round(qaScore) : null,
            qaStatus: qaStatus || null,
            status: 'active',
            isActive: true,
          },
        });
      });
    } catch (error) {
      // Handle unique constraint violation from partial unique index
      // This can occur in rare race conditions despite the transaction
      if (isUniqueConstraintError(error)) {
        logger.warn(
          `[savePlanToDatabase] Unique constraint hit, retrying with forced deactivation`
        );

        // Force deactivate all active plans and retry
        await prisma.mealPlan.updateMany({
          where: { userId, isActive: true, deletedAt: null },
          data: { isActive: false, status: 'replaced' },
        });

        mealPlan = await prisma.mealPlan.create({
          data: {
            userId,
            profileId: profile.id,
            validatedPlan: planData,
            metabolicProfile: metabolicProfile || {},
            dailyKcalTarget: dailyKcalTarget ? Math.round(dailyKcalTarget) : null,
            dailyProteinG: dailyProteinG ? Math.round(dailyProteinG) : null,
            dailyCarbsG: dailyCarbsG ? Math.round(dailyCarbsG) : null,
            dailyFatG: dailyFatG ? Math.round(dailyFatG) : null,
            trainingBonusKcal: metabolicProfile?.trainingBonusKcal
              ? Math.round(metabolicProfile.trainingBonusKcal)
              : null,
            planDays,
            startDate,
            endDate,
            qaScore: qaScore ? Math.round(qaScore) : null,
            qaStatus: qaStatus || null,
            status: 'active',
            isActive: true,
          },
        });
      } else {
        throw error;
      }
    }

    // 6. Generate and upload PDF
    let pdfUrl: string | null = null;
    try {
      const pdfBuffer = generatePlanPdf(planData, {
        planId: mealPlan.id,
        userName: profile.name || undefined,
        dailyKcalTarget: dailyKcalTarget ? Math.round(dailyKcalTarget) : null,
        dailyProteinG: dailyProteinG ? Math.round(dailyProteinG) : null,
        dailyCarbsG: dailyCarbsG ? Math.round(dailyCarbsG) : null,
        dailyFatG: dailyFatG ? Math.round(dailyFatG) : null,
        generatedAt: new Date(),
      });

      const filename = `meal-plan-${mealPlan.id}.pdf`;
      const uploadResult = await uploadPlanPdf(pdfBuffer, filename);

      if (uploadResult.success && uploadResult.url) {
        pdfUrl = uploadResult.url;
        // Update MealPlan with the PDF URL
        await prisma.mealPlan.update({
          where: { id: mealPlan.id },
          data: { pdfUrl },
        });
        logger.info(`[savePlanToDatabase] PDF uploaded: ${pdfUrl}`);
      } else {
        logger.warn('[savePlanToDatabase] PDF upload failed:', uploadResult.error);
      }
    } catch (pdfError) {
      // PDF generation is non-blocking - plan is still saved
      logger.warn('[savePlanToDatabase] PDF generation error:', pdfError);
    }

    // 7. Update the PlanGenerationJob with result and status
    // result is now a Prisma Json type - pass object directly
    await prisma.planGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result: { planId: mealPlan.id, pdfUrl },
        completedAt: new Date(),
      },
    });

    return { success: true, planId: mealPlan.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error saving plan';
    logger.error('[savePlanToDatabase] Error:', error);

    // Try to mark the job as failed
    try {
      await prisma.planGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      });
    } catch {
      // If we can't update the job, just log it
      logger.error('[savePlanToDatabase] Could not update job status');
    }

    return { success: false, error: errorMessage };
  }
}
