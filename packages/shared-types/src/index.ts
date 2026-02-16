/**
 * @zsn/shared-types
 *
 * Types shared between apps/web and workers/queue-processor.
 * Domain-specific pipeline types (MealPlan, MetabolicProfile, etc.)
 * live in @zero-sum/nutrition-engine.
 */

export type { PlanGenerationJobData, JobStatus, JobProgressUpdate } from './queue-jobs.js';

export type { PlanCompletePayload, PlanCompleteResponse } from './api-responses.js';
