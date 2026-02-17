/**
 * Centralized API key / config validation for the nutrition-engine package.
 *
 * Unlike the worker-level env validation (`workers/queue-processor/src/env.ts`)
 * which covers worker-specific variables (Redis, internal secrets, etc.), this
 * module validates only the keys required by the pipeline itself. It is called
 * early in the orchestrator lifecycle to surface misconfigurations before any
 * expensive work begins.
 */

import { engineLogger } from '../utils/logger';

/** The subset of environment config the pipeline needs to operate. */
export interface PipelineEnvConfig {
  anthropicApiKey: string;
  fatsecretClientId: string;
  fatsecretClientSecret: string;
  usdaApiKey?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate pipeline configuration keys before the orchestrator starts work.
 *
 * Returns a structured result with separate `errors` (fatal -- pipeline cannot
 * run) and `warnings` (non-fatal -- some features may be degraded).
 */
export function validatePipelineConfig(config: PipelineEnvConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // -- Anthropic (required) --------------------------------------------------
  if (!config.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY is missing');
  } else if (!config.anthropicApiKey.startsWith('sk-ant-')) {
    warnings.push('ANTHROPIC_API_KEY does not start with expected prefix "sk-ant-"');
  }

  // -- FatSecret (required) ---------------------------------------------------
  if (!config.fatsecretClientId) {
    errors.push('FATSECRET_CLIENT_ID is missing');
  }

  if (!config.fatsecretClientSecret) {
    errors.push('FATSECRET_CLIENT_SECRET is missing');
  }

  // -- USDA (optional fallback) -----------------------------------------------
  if (!config.usdaApiKey) {
    warnings.push('USDA_API_KEY is not set - USDA fallback will be unavailable');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate and log results. Throws if any errors are present.
 * Intended as a convenience wrapper for the orchestrator constructor.
 */
export function assertPipelineConfig(config: PipelineEnvConfig): void {
  const result = validatePipelineConfig(config);

  for (const warning of result.warnings) {
    engineLogger.warn(`[Config] ${warning}`);
  }

  if (!result.valid) {
    const summary = result.errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`Pipeline configuration is invalid:\n${summary}`);
  }
}
