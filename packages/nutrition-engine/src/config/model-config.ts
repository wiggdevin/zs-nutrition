import { engineLogger } from '../utils/logger';

export interface ModelConfig {
  model: string;
  maxTokens: number;
  fallbackModel?: string;
}

export type ModelConfigMap = Record<string, ModelConfig>;

export const DEFAULT_MODEL_CONFIG: ModelConfigMap = {
  recipeRound1: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    fallbackModel: 'claude-sonnet-4-20250514',
  },
  recipeRound2: { model: 'claude-sonnet-4-20250514', maxTokens: 16384 },
  complianceRegen: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    fallbackModel: 'claude-sonnet-4-20250514',
  },
  vision: { model: 'claude-sonnet-4-20250514', maxTokens: 2048 },
  insights: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    fallbackModel: 'claude-sonnet-4-20250514',
  },
  chat: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    fallbackModel: 'claude-sonnet-4-20250514',
  },
};

/** Load model config with optional env override for A/B testing */
export function getModelConfig(): ModelConfigMap {
  const envOverride = process.env.LLM_MODEL_CONFIG;
  if (envOverride) {
    try {
      const parsed = JSON.parse(envOverride);
      return { ...DEFAULT_MODEL_CONFIG, ...parsed };
    } catch {
      // Invalid JSON, use defaults
    }
  }
  return DEFAULT_MODEL_CONFIG;
}

export function getConfig(key: string): ModelConfig {
  const config = getModelConfig();
  return config[key] || { model: 'claude-sonnet-4-20250514', maxTokens: 4096 };
}

/** Call an LLM with automatic fallback to a secondary model on failure */
export async function callWithFallback<T>(
  config: ModelConfig,
  createCall: (model: string, maxTokens: number) => Promise<T>
): Promise<T> {
  try {
    return await createCall(config.model, config.maxTokens);
  } catch (error) {
    if (config.fallbackModel) {
      engineLogger.warn(
        `[ModelRouter] ${config.model} failed, falling back to ${config.fallbackModel}`
      );
      return await createCall(config.fallbackModel, config.maxTokens);
    }
    throw error;
  }
}
