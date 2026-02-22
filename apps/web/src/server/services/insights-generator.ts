import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import {
  type InsightsDataPayload,
  type InsightItem,
  insightItemSchema,
  claudeInsightsToolSchema,
} from '@/lib/insights/schemas';
import {
  insightsLogger,
  categorizeError,
  InsightsErrorCategory,
} from '@/server/utils/insights-logger';
import { getConfig, callWithFallback } from '@zero-sum/nutrition-engine';

// ---------------------------------------------------------------------------
// Lazy singleton Claude client (mirrors pattern in claude-chat.ts)
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getInsightsClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({ apiKey, timeout: 30_000 });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const insightsConfig = getConfig('insights');
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

const SYSTEM_PROMPT = `You are a nutrition data analyst. Analyze the user's tracking data and generate exactly 2-3 actionable insights. Reference SPECIFIC numbers from the data. Prioritize: (1) patterns requiring action > (2) warnings > (3) positive observations. Include at least one positive insight if the data supports it. Be encouraging but honest. Never repeat the same category twice. Use the generate_nutrition_insights tool to return your analysis.`;

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/**
 * Retries an async operation with exponential backoff.
 * Only retries on rate-limit (429) and overloaded (529) errors.
 * Auth errors (401) are thrown immediately without retry.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const category = categorizeError(error);
      const message = error instanceof Error ? error.message : String(error);

      // Auth errors are non-recoverable -- surface immediately
      if (category === InsightsErrorCategory.CLAUDE_AUTH_ERROR) {
        throw error;
      }

      insightsLogger.claudeFailed(attempt, message);

      // Only retry on rate-limit or overloaded
      const isRetryable =
        category === InsightsErrorCategory.CLAUDE_RATE_LIMIT ||
        category === InsightsErrorCategory.CLAUDE_OVERLOADED;

      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error('withRetry exhausted all attempts');
}

// ---------------------------------------------------------------------------
// Main export: generate insights via Claude tool_use
// ---------------------------------------------------------------------------

export async function generateInsights(payload: InsightsDataPayload): Promise<{
  insights: InsightItem[];
  tokenUsage: { inputTokens: number; outputTokens: number };
}> {
  try {
    const anthropic = getInsightsClient();
    const payloadStr = JSON.stringify(payload);

    // Rough token estimate: ~4 chars per token
    const estTokens = Math.ceil(payloadStr.length / 4);
    insightsLogger.claudeRequest(estTokens);

    const startMs = Date.now();

    // Cast to Anthropic.Tool to strip `readonly` from `as const` schema arrays
    const tool = claudeInsightsToolSchema as unknown as Anthropic.Messages.Tool;

    const response = await callWithFallback(insightsConfig, (model, maxTokens) =>
      withRetry(() =>
        anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          stream: false,
          system: [
            {
              type: 'text' as const,
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' as const },
            },
          ],
          tools: [tool],
          tool_choice: { type: 'tool', name: 'generate_nutrition_insights' },
          messages: [{ role: 'user', content: payloadStr }],
        })
      )
    );

    const durationMs = Date.now() - startMs;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    // Extract the tool_use content block
    const toolBlock = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolBlock) {
      throw new Error('Claude response did not contain a tool_use block');
    }

    const toolInput = toolBlock.input as { recommendations?: unknown[] };
    const rawRecommendations = toolInput.recommendations;

    if (!Array.isArray(rawRecommendations) || rawRecommendations.length === 0) {
      throw new Error('Claude tool response missing recommendations array');
    }

    insightsLogger.claudeResponse({
      inputTokens,
      outputTokens,
      cacheReadTokens: (response.usage as any)?.cache_read_input_tokens ?? 0,
      recommendations: rawRecommendations.length,
      durationMs,
    });

    // Validate each item against the Zod schema
    const validatedInsights: InsightItem[] = [];
    const validationErrors: string[] = [];

    for (const raw of rawRecommendations) {
      const item = raw as Record<string, unknown>;

      // Ensure every item has a valid UUID id
      if (!item.id || typeof item.id !== 'string') {
        item.id = randomUUID();
      }

      const result = insightItemSchema.safeParse(item);
      if (result.success) {
        validatedInsights.push(result.data);
      } else {
        validationErrors.push(
          result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        );
      }
    }

    // If any item failed validation, reject the entire batch and fall through to fallback
    if (validationErrors.length > 0) {
      insightsLogger.validationFailed(validationErrors);
      const fallback = generateFallbackInsights(payload);
      return { insights: fallback, tokenUsage: { inputTokens, outputTokens } };
    }

    return { insights: validatedInsights, tokenUsage: { inputTokens, outputTokens } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    insightsLogger.claudeFailed(0, message);

    // Last resort: deterministic fallback with zero token usage
    const fallback = generateFallbackInsights(payload);
    return { insights: fallback, tokenUsage: { inputTokens: 0, outputTokens: 0 } };
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallback: generate insights from pre-computed data
// ---------------------------------------------------------------------------

// Severity priority for sorting (lower = higher priority)
const SEVERITY_PRIORITY: Record<string, number> = {
  action: 0,
  warning: 1,
  info: 2,
};

interface FallbackCandidate {
  insight: InsightItem;
  priority: number;
}

export function generateFallbackInsights(payload: InsightsDataPayload): InsightItem[] {
  const candidates: FallbackCandidate[] = [];

  // Rule 1: Protein deficiency
  if (payload.avgProteinGap < -20) {
    const deficit = Math.abs(Math.round(payload.avgProteinGap));
    candidates.push({
      priority: SEVERITY_PRIORITY.action,
      insight: {
        id: randomUUID(),
        category: 'macro_deficiency',
        title: 'Protein intake below target',
        body: `Over the past ${payload.daysTracked} days, you averaged ${deficit}g below your daily protein target of ${payload.proteinTargetG}g. Consider adding a high-protein snack or increasing portion sizes at meals.`,
        supportingData: {
          metric: 'Avg daily protein gap',
          actual: `${Math.round(payload.proteinTargetG + payload.avgProteinGap)}g`,
          target: `${payload.proteinTargetG}g`,
          trend: `${deficit}g deficit`,
        },
        severity: 'action',
        ctaType: 'adjust_macros',
        ctaLabel: 'Adjust Macros',
      },
    });
  }

  // Rule 2: Overconsumption
  if (payload.avgCalorieDeficit > 300) {
    const surplus = Math.round(payload.avgCalorieDeficit);
    candidates.push({
      priority: SEVERITY_PRIORITY.action,
      insight: {
        id: randomUUID(),
        category: 'overconsumption_pattern',
        title: 'Calorie intake above target',
        body: `You averaged ${surplus} kcal over your daily target of ${payload.dailyKcalTarget} kcal across ${payload.daysTracked} tracked days. Review portion sizes or swap higher-calorie meals.`,
        supportingData: {
          metric: 'Avg daily calorie surplus',
          actual: `${Math.round(payload.dailyKcalTarget + surplus)} kcal`,
          target: `${payload.dailyKcalTarget} kcal`,
          trend: `+${surplus} kcal/day`,
        },
        severity: 'action',
        ctaType: 'swap_meals',
        ctaLabel: 'Swap Meals',
      },
    });
  }

  // Rule 3: Weight plateau
  if (payload.isPlateau) {
    candidates.push({
      priority: SEVERITY_PRIORITY.warning,
      insight: {
        id: randomUUID(),
        category: 'weight_plateau',
        title: 'Weight trend has stalled',
        body: `Your weight has plateaued over the tracking window despite a ${payload.goalType} goal. Consider adjusting your calorie target or meal plan to break through.`,
        supportingData: {
          metric: 'Weight trend',
          actual:
            payload.weightTrendLbsPerWeek !== null
              ? `${payload.weightTrendLbsPerWeek} lbs/week`
              : 'No change',
          target: `${payload.goalRate} lbs/week`,
          trend: 'Plateau detected',
        },
        severity: 'warning',
        ctaType: 'regenerate_plan',
        ctaLabel: 'Regenerate Plan',
      },
    });
  }

  // Rule 4: Low adherence
  if (payload.daysWithLowAdherence > 3) {
    candidates.push({
      priority: SEVERITY_PRIORITY.warning,
      insight: {
        id: randomUUID(),
        category: 'low_adherence',
        title: 'Tracking consistency needs work',
        body: `${payload.daysWithLowAdherence} of your last ${payload.daysTracked} days had low adherence (avg ${Math.round(payload.avgAdherence * 100)}%). Consistent tracking helps you see real patterns.`,
        supportingData: {
          metric: 'Days with low adherence',
          actual: `${payload.daysWithLowAdherence} days`,
          target: '0 days',
          trend: `${Math.round(payload.avgAdherence * 100)}% avg adherence`,
        },
        severity: 'warning',
        ctaType: 'view_trends',
        ctaLabel: 'View Trends',
      },
    });
  }

  // Rule 5: Positive streak
  if (payload.streakDays >= 5) {
    candidates.push({
      priority: SEVERITY_PRIORITY.info,
      insight: {
        id: randomUUID(),
        category: 'positive_streak',
        title: `${payload.streakDays}-day tracking streak`,
        body: `You have tracked ${payload.streakDays} days in a row. Consistency is the foundation of progress -- keep going!`,
        supportingData: {
          metric: 'Current streak',
          actual: `${payload.streakDays} days`,
          target: '7 days',
          trend: 'Consistent',
        },
        severity: 'info',
        ctaType: 'view_trends',
        ctaLabel: 'View Trends',
      },
    });
  }

  // Rule 6: Unused plan meals
  if (payload.planMealPct < 0.3) {
    const pct = Math.round(payload.planMealPct * 100);
    candidates.push({
      priority: SEVERITY_PRIORITY.warning,
      insight: {
        id: randomUUID(),
        category: 'unused_plan_meals',
        title: 'Most planned meals are unused',
        body: `Only ${pct}% of your logged meals came from your plan (${payload.totalMeals} total meals). Consider regenerating a plan that better fits your preferences.`,
        supportingData: {
          metric: 'Plan meal usage',
          actual: `${pct}%`,
          target: '70%',
          trend: `${payload.totalSwaps} swaps made`,
        },
        severity: 'warning',
        ctaType: 'regenerate_plan',
        ctaLabel: 'Regenerate Plan',
      },
    });
  }

  // Rule 7: Poor sleep / recovery impact
  if (payload.daysWithPoorSleep > 3 && payload.avgSleepScore !== null) {
    candidates.push({
      priority: SEVERITY_PRIORITY.warning,
      insight: {
        id: randomUUID(),
        category: 'recovery_impact',
        title: 'Poor sleep may affect progress',
        body: `You had ${payload.daysWithPoorSleep} days of poor sleep (avg score: ${Math.round(payload.avgSleepScore)}). Sleep quality impacts recovery, hunger hormones, and adherence.`,
        supportingData: {
          metric: 'Avg sleep score',
          actual: `${Math.round(payload.avgSleepScore)}`,
          target: '75',
          trend: `${payload.daysWithPoorSleep} poor days`,
        },
        severity: 'warning',
        ctaType: 'view_trends',
        ctaLabel: 'View Trends',
      },
    });
  }

  // Sort by severity priority (action > warning > info) and take top 2-3
  candidates.sort((a, b) => a.priority - b.priority);

  // Ensure at least 2, at most 3
  const selected = candidates.slice(0, 3);

  // If fewer than 2 candidates, pad with a generic positive insight
  if (selected.length < 2) {
    selected.push({
      priority: SEVERITY_PRIORITY.info,
      insight: {
        id: randomUUID(),
        category: 'positive_streak',
        title: 'Keep tracking for better insights',
        body: `With ${payload.daysTracked} days tracked so far, the more data you log the more accurate your insights will become. Every meal logged helps.`,
        supportingData: {
          metric: 'Days tracked',
          actual: `${payload.daysTracked} days`,
          target: '14 days',
          trend: 'Building data',
        },
        severity: 'info',
        ctaType: 'view_plan',
        ctaLabel: 'View Plan',
      },
    });
  }

  const insights = selected.map((c) => c.insight);
  insightsLogger.fallback(insights.length);

  return insights;
}
