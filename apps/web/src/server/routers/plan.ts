import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { TRPCError } from '@trpc/server'
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue'
import { safeLogWarn } from '@/lib/safe-logger'

/**
 * Zod schema for the raw intake form data passed to generatePlan.
 * Matches the app spec's RawIntakeFormSchema.
 */
const RawIntakeFormSchema = z.object({
  name: z.string().min(1),
  sex: z.enum(['male', 'female']),
  age: z.number().int().min(18).max(100),
  heightFeet: z.number().optional(),
  heightInches: z.number().optional(),
  heightCm: z.number().optional(),
  weightLbs: z.number().optional(),
  weightKg: z.number().optional(),
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
  trainingDays: z.array(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  ),
  trainingTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
  dietaryStyle: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo']),
  allergies: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  cuisinePreferences: z.array(z.string()).default([]),
  mealsPerDay: z.number().int().min(2).max(6),
  snacksPerDay: z.number().int().min(0).max(4),
  cookingSkill: z.number().int().min(1).max(10),
  prepTimeMaxMin: z.number().int().min(10).max(120),
  macroStyle: z.enum(['balanced', 'high_protein', 'low_carb', 'keto']),
  planDurationDays: z.number().int().min(1).max(7).default(7),
})

/**
 * Schema for the pipeline result that contains the validated plan data.
 * This is what comes back from the nutrition engine after successful generation.
 */
const MetabolicProfileSchema = z.object({
  bmrKcal: z.number(),
  tdeeKcal: z.number(),
  goalKcal: z.number(),
  proteinTargetG: z.number(),
  carbsTargetG: z.number(),
  fatTargetG: z.number(),
}).passthrough()

const PlanResultSchema = z.object({
  validatedPlan: z.record(z.unknown()), // Full MealPlanValidated JSON
  metabolicProfile: MetabolicProfileSchema,
  dailyKcalTarget: z.number().int(),
  dailyProteinG: z.number().int(),
  dailyCarbsG: z.number().int(),
  dailyFatG: z.number().int(),
  trainingBonusKcal: z.number().int().optional().default(0),
  planDays: z.number().int().min(1).max(7).default(7),
  qaScore: z.number().int().min(0).max(100),
  qaStatus: z.enum(['PASS', 'WARN', 'FAIL']),
})

export const planRouter = router({
  /**
   * getActivePlan query:
   * Returns the user's currently active meal plan.
   * Finds the plan with isActive=true and status='active' for the authenticated user.
   * Returns null if no active plan exists.
   */
  getActivePlan: protectedProcedure
    .query(async ({ ctx }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      const plan = await prisma.mealPlan.findFirst({
        where: {
          userId: dbUserId,
          isActive: true,
          status: 'active',
        },
        orderBy: { generatedAt: 'desc' },
      })

      if (!plan) return null

      let parsedPlan: Record<string, unknown> = {}
      try {
        parsedPlan = JSON.parse(plan.validatedPlan)
      } catch { /* empty */ }

      let parsedMetabolic: Record<string, unknown> = {}
      try {
        parsedMetabolic = JSON.parse(plan.metabolicProfile)
      } catch { /* empty */ }

      return {
        id: plan.id,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        trainingBonusKcal: plan.trainingBonusKcal,
        planDays: plan.planDays,
        startDate: plan.startDate,
        endDate: plan.endDate,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        status: plan.status,
        isActive: plan.isActive,
        validatedPlan: parsedPlan,
        metabolicProfile: parsedMetabolic,
      }
    }),

  /**
   * getPlanById query:
   * Returns a specific meal plan by ID, but ONLY if it belongs to the authenticated user.
   * This prevents users from accessing other users' plans via URL/ID manipulation.
   * Returns NOT_FOUND for both missing plans and plans belonging to other users
   * (to avoid leaking information about plan existence).
   */
  getPlanById: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Find the plan by ID, filtered by userId for security
      const plan = await prisma.mealPlan.findFirst({
        where: {
          id: input.planId,
          userId: dbUserId, // Security: only return plans owned by this user
        },
      })

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meal plan not found.',
        })
      }

      let parsedPlan: Record<string, unknown> = {}
      try {
        parsedPlan = JSON.parse(plan.validatedPlan)
      } catch { /* empty */ }

      let parsedMetabolic: Record<string, unknown> = {}
      try {
        parsedMetabolic = JSON.parse(plan.metabolicProfile)
      } catch { /* empty */ }

      return {
        id: plan.id,
        dailyKcalTarget: plan.dailyKcalTarget,
        dailyProteinG: plan.dailyProteinG,
        dailyCarbsG: plan.dailyCarbsG,
        dailyFatG: plan.dailyFatG,
        trainingBonusKcal: plan.trainingBonusKcal,
        planDays: plan.planDays,
        startDate: plan.startDate,
        endDate: plan.endDate,
        qaScore: plan.qaScore,
        qaStatus: plan.qaStatus,
        status: plan.status,
        validatedPlan: parsedPlan,
        metabolicProfile: parsedMetabolic,
      }
    }),

  /**
   * generatePlan mutation:
   * 1. Creates a PlanGenerationJob record in DB with status 'pending'
   * 2. Enqueues a BullMQ job for the worker to process
   * 3. Returns jobId immediately (fast response, no waiting for generation)
   */
  generatePlan: protectedProcedure
    .input(RawIntakeFormSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Create PlanGenerationJob record in DB with status 'pending'
      // SQLite stores JSON as string, so stringify the intake data
      const job = await prisma.planGenerationJob.create({
        data: {
          userId: dbUserId,
          status: 'pending',
          intakeData: JSON.stringify(input),
        },
      })

      // Enqueue BullMQ job
      const bullmqJobData: PlanGenerationJobData = {
        jobId: job.id,
        userId: dbUserId,
        intakeData: input as Record<string, unknown>,
      }

      try {
        await planGenerationQueue.add(
          'generate-plan',
          bullmqJobData,
          {
            jobId: job.id, // Use DB job ID as BullMQ job ID for easy correlation
          }
        )
      } catch (queueError) {
        // If Redis/BullMQ is unavailable (dev environment), log and continue
        // The job is still created in DB — worker will pick it up when available
        safeLogWarn('BullMQ enqueue failed (Redis may be unavailable):', queueError)
        // In dev mode, this is expected if Redis isn't running
        // The job record in DB still serves as the source of truth
      }

      // Return jobId immediately - client will open SSE to track progress
      return { jobId: job.id }
    }),

  /**
   * getJobStatus query: Check the current status of a plan generation job.
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      const job = await prisma.planGenerationJob.findFirst({
        where: {
          id: input.jobId,
          userId: dbUserId,
        },
      })

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found.',
        })
      }

      // Parse JSON string fields for SQLite compatibility
      let parsedProgress = null
      let parsedPlanId: string | undefined = undefined
      try {
        if (job.progress) parsedProgress = JSON.parse(job.progress)
      } catch { /* ignore parse errors */ }
      try {
        if (job.result) {
          const resultObj = JSON.parse(job.result)
          parsedPlanId = resultObj.planId as string | undefined
        }
      } catch { /* ignore parse errors */ }

      return {
        status: job.status,
        currentAgent: job.currentAgent,
        progress: parsedProgress,
        error: job.error,
        planId: parsedPlanId,
      }
    }),

  /**
   * completeJob mutation:
   * Called when plan generation finishes (by worker callback or polling).
   * 1. Validates the plan result data
   * 2. Finds the user's active profile
   * 3. Deactivates any existing active MealPlans
   * 4. Creates a new MealPlan record with all denormalized fields
   * 5. Updates the PlanGenerationJob status to 'completed' with result
   */
  completeJob: protectedProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        planResult: PlanResultSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Verify the job exists and belongs to this user
      const job = await prisma.planGenerationJob.findFirst({
        where: {
          id: input.jobId,
          userId: dbUserId,
        },
      })

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan generation job not found.',
        })
      }

      // Find user's active profile (most recent)
      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })

      if (!profile) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No active user profile found. Complete onboarding first.',
        })
      }

      // Calculate start/end dates
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + input.planResult.planDays)

      // Deactivate existing active plans for this user
      await prisma.mealPlan.updateMany({
        where: { userId: dbUserId, isActive: true },
        data: { isActive: false, status: 'replaced' },
      })

      // Create the MealPlan with all denormalized fields
      const mealPlan = await prisma.mealPlan.create({
        data: {
          userId: dbUserId,
          profileId: profile.id,
          validatedPlan: JSON.stringify(input.planResult.validatedPlan),
          metabolicProfile: JSON.stringify(input.planResult.metabolicProfile),
          dailyKcalTarget: input.planResult.dailyKcalTarget,
          dailyProteinG: input.planResult.dailyProteinG,
          dailyCarbsG: input.planResult.dailyCarbsG,
          dailyFatG: input.planResult.dailyFatG,
          trainingBonusKcal: input.planResult.trainingBonusKcal,
          planDays: input.planResult.planDays,
          startDate,
          endDate,
          qaScore: input.planResult.qaScore,
          qaStatus: input.planResult.qaStatus,
          status: 'active',
          isActive: true,
        },
      })

      // Update the PlanGenerationJob as completed
      await prisma.planGenerationJob.update({
        where: { id: input.jobId },
        data: {
          status: 'completed',
          result: JSON.stringify({ planId: mealPlan.id }),
          completedAt: new Date(),
        },
      })

      return {
        planId: mealPlan.id,
        status: 'active',
        isActive: true,
        dailyKcalTarget: mealPlan.dailyKcalTarget,
        qaScore: mealPlan.qaScore,
        qaStatus: mealPlan.qaStatus,
      }
    }),

  /**
   * regeneratePlan mutation:
   * Regenerates a meal plan using the user's current active profile data.
   * This allows users to update their settings (e.g., weight change) and regenerate
   * without going through onboarding again. The old plan is marked as 'replaced'.
   */
  regeneratePlan: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { prisma } = ctx
      const dbUserId = (ctx as Record<string, unknown>).dbUserId as string

      // Find user's active profile
      const profile = await prisma.userProfile.findFirst({
        where: { userId: dbUserId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })

      if (!profile) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No active user profile found. Complete onboarding first.',
        })
      }

      // Parse JSON array fields from profile
      let allergies: string[] = []
      let exclusions: string[] = []
      let cuisinePreferences: string[] = []
      let trainingDays: string[] = []

      try {
        allergies = profile.allergies ? JSON.parse(profile.allergies) : []
        exclusions = profile.exclusions ? JSON.parse(profile.exclusions) : []
        cuisinePreferences = profile.cuisinePrefs ? JSON.parse(profile.cuisinePrefs) : []
        trainingDays = profile.trainingDays ? JSON.parse(profile.trainingDays) : []
      } catch (parseError) {
        safeLogWarn('Failed to parse profile JSON arrays:', parseError)
      }

      // Construct intake data from active profile (matching RawIntakeFormSchema)
      const intakeData = {
        name: profile.name,
        sex: profile.sex as 'male' | 'female',
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatPercent: profile.bodyFatPercent ?? undefined,
        goalType: profile.goalType as 'cut' | 'maintain' | 'bulk',
        goalRate: profile.goalRate,
        activityLevel: profile.activityLevel as
          | 'sedentary'
          | 'lightly_active'
          | 'moderately_active'
          | 'very_active'
          | 'extremely_active',
        trainingDays: trainingDays as Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
        trainingTime: profile.trainingTime as 'morning' | 'afternoon' | 'evening' | undefined,
        dietaryStyle: profile.dietaryStyle as
          | 'omnivore'
          | 'vegetarian'
          | 'vegan'
          | 'pescatarian'
          | 'keto'
          | 'paleo',
        allergies,
        exclusions,
        cuisinePreferences,
        mealsPerDay: profile.mealsPerDay,
        snacksPerDay: profile.snacksPerDay,
        cookingSkill: profile.cookingSkill,
        prepTimeMaxMin: profile.prepTimeMax,
        macroStyle: profile.macroStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto',
        planDurationDays: 7, // Default to 7 days
      }

      // Create PlanGenerationJob record in DB with status 'pending'
      const job = await prisma.planGenerationJob.create({
        data: {
          userId: dbUserId,
          status: 'pending',
          intakeData: JSON.stringify(intakeData),
        },
      })

      // Enqueue BullMQ job
      const bullmqJobData: PlanGenerationJobData = {
        jobId: job.id,
        userId: dbUserId,
        intakeData: intakeData as Record<string, unknown>,
      }

      try {
        await planGenerationQueue.add(
          'generate-plan',
          bullmqJobData,
          {
            jobId: job.id, // Use DB job ID as BullMQ job ID for easy correlation
          }
        )
      } catch (queueError) {
        // If Redis/BullMQ is unavailable (dev environment), log and continue
        safeLogWarn('BullMQ enqueue failed (Redis may be unavailable):', queueError)
      }

      // Return jobId immediately - client will open SSE to track progress
      return { jobId: job.id }
    }),
})
