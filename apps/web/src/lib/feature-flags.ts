/**
 * Feature flags with optional Vercel Edge Config backend.
 * Falls back to environment variables when Edge Config is unavailable.
 */

export type FeatureFlag = {
  enabled: boolean;
  rolloutPercent?: number;
  allowlist?: string[];
};

export const FEATURE_FLAGS = {
  NEW_MEAL_PLAN_UI: 'new-meal-plan-ui',
  FAST_PATH_GENERATION: 'fast-path-generation',
  FOOD_SCAN: 'food-scan',
  PLAN_VERSIONING: 'plan-versioning',
  ADVANCED_MACROS: 'advanced-macros',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

let edgeConfigModule: { get: (key: string) => Promise<unknown> } | null = null;

async function loadEdgeConfig() {
  // Edge Config integration is optional — only used when @vercel/edge-config is installed
  // and EDGE_CONFIG env var is set. Otherwise falls back to env vars.
  if (edgeConfigModule !== null || !process.env.EDGE_CONFIG) return;
  try {
    // Dynamic require avoids webpack bundling the optional dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@vercel/edge-config');
    edgeConfigModule = mod;
  } catch (err) {
    // @vercel/edge-config is an optional dependency — not present in all environments
    console.warn(
      '[FeatureFlags] @vercel/edge-config not available, falling back to env vars:',
      err
    );
    edgeConfigModule = null;
  }
}

/**
 * Deterministic hash for percentage-based rollouts.
 * FNV-1a 32-bit produces a uniform distribution.
 */
function deterministicHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

function envFlagName(flagName: string): string {
  return `FEATURE_FLAG_${flagName.toUpperCase().replace(/-/g, '_')}`;
}

function readFlagFromEnv(flagName: string): FeatureFlag | null {
  const envValue = process.env[envFlagName(flagName)];
  if (envValue === undefined) return null;

  // Parse JSON value if provided, e.g. {"enabled":true,"rolloutPercent":50}
  if (envValue.startsWith('{')) {
    try {
      const parsed = JSON.parse(envValue);
      return {
        enabled: Boolean(parsed.enabled),
        rolloutPercent: parsed.rolloutPercent,
        allowlist: parsed.allowlist,
      };
    } catch (err) {
      console.warn(
        `[FeatureFlags] Failed to parse JSON for flag "${flagName}", treating as boolean:`,
        err
      );
      // Fall through to simple boolean
    }
  }

  return { enabled: envValue === 'true' || envValue === '1' };
}

function evaluateFlag(flag: FeatureFlag, flagName: string, userId?: string): boolean {
  if (!flag.enabled) return false;

  // Allowlist takes priority — if user is in allowlist, always enable
  if (flag.allowlist?.length && userId) {
    if (flag.allowlist.includes(userId)) return true;
  }

  // Percentage rollout requires a userId for deterministic bucketing
  if (flag.rolloutPercent !== undefined) {
    if (!userId) return false;
    return deterministicHash(flagName + userId) < flag.rolloutPercent;
  }

  return true;
}

export async function isFeatureEnabled(flagName: string, userId?: string): Promise<boolean> {
  await loadEdgeConfig();

  // Try Edge Config first
  if (edgeConfigModule) {
    try {
      const value = await edgeConfigModule.get(flagName);
      if (value !== null && value !== undefined) {
        const flag: FeatureFlag =
          typeof value === 'object' ? (value as FeatureFlag) : { enabled: Boolean(value) };
        return evaluateFlag(flag, flagName, userId);
      }
    } catch (err) {
      console.warn(
        `[FeatureFlags] Edge Config read failed for flag "${flagName}", falling back to env var:`,
        err
      );
    }
  }

  // Fallback to environment variable
  const envFlag = readFlagFromEnv(flagName);
  if (envFlag) {
    return evaluateFlag(envFlag, flagName, userId);
  }

  return false;
}

export async function getFeatureFlags(): Promise<Record<string, FeatureFlag>> {
  await loadEdgeConfig();
  const flags: Record<string, FeatureFlag> = {};

  for (const name of Object.values(FEATURE_FLAGS)) {
    // Try Edge Config
    if (edgeConfigModule) {
      try {
        const value = await edgeConfigModule.get(name);
        if (value !== null && value !== undefined) {
          flags[name] =
            typeof value === 'object' ? (value as FeatureFlag) : { enabled: Boolean(value) };
          continue;
        }
      } catch (err) {
        console.warn(
          `[FeatureFlags] Edge Config read failed for flag "${name}", falling back to env var:`,
          err
        );
      }
    }

    // Fallback to env
    const envFlag = readFlagFromEnv(name);
    if (envFlag) {
      flags[name] = envFlag;
    } else {
      flags[name] = { enabled: false };
    }
  }

  return flags;
}
