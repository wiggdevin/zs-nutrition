/**
 * Queue name constants shared across web app and worker.
 * Single source of truth to prevent drift between producers and consumers.
 */
export const QUEUE_NAMES = {
  PLAN_GENERATION: 'plan-generation',
  DEAD_LETTER: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Convenience alias for the most commonly used queue name.
 */
export const PLAN_GENERATION_QUEUE = QUEUE_NAMES.PLAN_GENERATION;
