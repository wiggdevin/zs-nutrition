import { NextResponse } from 'next/server';
import { savePlanToDatabase } from '@/lib/save-plan';
import { isDevMode } from '@/lib/auth';
import { logger } from '@/lib/safe-logger';
import { planGenerationQueue, type PlanGenerationJobData } from '@/lib/queue';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';
import {
  authenticateAndRateLimit,
  findOrCreateUserWithProfile,
  validateActiveProfile,
  buildIntakeData,
  checkExistingJob,
  createPlanGenerationJob,
  generateSimulatedPlan,
  calculateSimulatedMetabolicProfile,
} from '@/lib/plan-generation';

const useMockQueue = process.env.USE_MOCK_QUEUE === 'true';

// POST - Create a plan generation job
export async function POST() {
  try {
    // Authenticate and rate limit
    const authResult = await authenticateAndRateLimit();
    if ('errorResponse' in authResult) return authResult.errorResponse;
    const { clerkUserId } = authResult;

    // Find or create user with active profile
    const user = await findOrCreateUserWithProfile(clerkUserId);
    const profileResult = validateActiveProfile(user);
    if ('errorResponse' in profileResult) return profileResult.errorResponse;
    const { activeProfile } = profileResult;

    // Check for existing pending/running jobs to prevent duplicates
    const existingJobResponse = await checkExistingJob(user.id);
    if (existingJobResponse) return existingJobResponse;

    // Build intake data and create job
    const { intakeData, allergies, exclusions } = buildIntakeData(activeProfile);
    const job = await createPlanGenerationJob(user.id, intakeData);

    // In dev mode with mock queue, simulate pipeline completion
    let planId: string | undefined;
    if (isDevMode || useMockQueue) {
      try {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const simulatedPlanData = generateSimulatedPlan(
          activeProfile,
          startDate,
          allergies,
          exclusions,
          activeProfile.prepTimeMax
        );
        const simulatedMetabolicProfile = calculateSimulatedMetabolicProfile(activeProfile);

        const saveResult = await savePlanToDatabase({
          jobId: job.id,
          planData: simulatedPlanData,
          metabolicProfile: simulatedMetabolicProfile,
        });

        if (saveResult.success) {
          planId = saveResult.planId;
          logger.debug(`[Dev Mode] Plan saved to database: ${planId}`);
        } else {
          logger.warn('[Dev Mode] Failed to save plan:', saveResult.error);
        }
      } catch (saveError) {
        logger.warn('[Dev Mode] Error saving simulated plan:', saveError);
      }
    }

    // Production: enqueue to BullMQ for worker processing
    if (!isDevMode && !useMockQueue) {
      // Pre-flight: verify Redis is reachable before attempting to enqueue
      const redisOk = await checkRedisHealth();
      if (!redisOk) {
        logger.error('Pre-flight Redis check failed — cannot enqueue job');
        await prisma.planGenerationJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: 'Redis unavailable — could not enqueue job' },
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Plan generation service is temporarily unavailable. Please try again later.',
          },
          { status: 503 }
        );
      }

      const bullmqJobData: PlanGenerationJobData = {
        jobId: job.id,
        pipelinePath: 'full',
        traceId: crypto.randomUUID(),
      };

      try {
        await planGenerationQueue.add('generate-plan', bullmqJobData, {
          jobId: job.id,
        });
      } catch (queueError) {
        logger.error('BullMQ enqueue failed (Redis may be unavailable):', queueError);
        await prisma.planGenerationJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: 'Failed to enqueue job — queue unavailable' },
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Plan generation service is temporarily unavailable. Please try again later.',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      planId,
    });
  } catch (error) {
    logger.error('Plan generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
