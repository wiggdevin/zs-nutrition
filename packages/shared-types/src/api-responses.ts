/**
 * Shared API response shapes used across the web app and worker.
 *
 * These types define contracts for internal API communication
 * (e.g., worker -> web app callbacks).
 */

/**
 * Payload sent by the queue-processor worker to the web app's
 * POST /api/plan/complete endpoint after successful plan generation.
 */
export interface PlanCompletePayload {
  jobId: string;
  planData: unknown;
  metabolicProfile: unknown;
}

/**
 * Response from the web app's POST /api/plan/complete endpoint.
 */
export interface PlanCompleteResponse {
  planId: string;
}
