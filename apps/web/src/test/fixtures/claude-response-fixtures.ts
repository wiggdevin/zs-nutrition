/**
 * Frozen Claude API response fixtures for AI Insights testing.
 *
 * Each fixture matches the Anthropic SDK `Message` shape returned by
 * `anthropic.messages.create()`. These are deterministic (no randomness)
 * so snapshot tests and assertions can rely on exact values.
 */

// ============================================================
// Reusable insight items matching InsightItem schema from schemas.ts
// ============================================================

const INSIGHT_MACRO_DEFICIENCY = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  category: 'macro_deficiency' as const,
  title: 'Protein intake consistently below target',
  body: 'Over the past 14 days, your average protein intake was 118g against a target of 150g. This 21% shortfall may slow muscle recovery and increase hunger between meals. Consider adding a protein shake post-workout or swapping a carb-heavy snack for Greek yogurt.',
  supportingData: {
    metric: 'Daily Protein (g)',
    actual: '118g avg',
    target: '150g',
    trend: 'declining over 14 days',
  },
  severity: 'action' as const,
  ctaType: 'adjust_macros' as const,
  ctaLabel: 'Adjust Macros',
};

const INSIGHT_LOW_ADHERENCE = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  category: 'low_adherence' as const,
  title: 'Weekend adherence drops significantly',
  body: 'Your weekday adherence averages 87% but drops to 48% on weekends. Saturday dinners are the biggest contributor, averaging 800 kcal over target. Pre-planning weekend meals or using the swap feature for flexible options could help bridge this gap.',
  supportingData: {
    metric: 'Weekend Adherence',
    actual: '48%',
    target: '75%+',
    trend: 'consistent pattern over 3 weekends',
  },
  severity: 'warning' as const,
  ctaType: 'swap_meals' as const,
  ctaLabel: 'Swap Weekend Meals',
};

const INSIGHT_POSITIVE_STREAK = {
  id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  category: 'positive_streak' as const,
  title: 'Great 5-day tracking streak!',
  body: "You've logged meals consistently for 5 days in a row with an average adherence of 89%. Your calorie accuracy has improved by 12% compared to last week. Keep up this momentum.",
  supportingData: {
    metric: 'Tracking Streak',
    actual: '5 days',
    target: '7 days',
    trend: 'improving',
  },
  severity: 'info' as const,
  ctaType: 'view_trends' as const,
  ctaLabel: 'View Trends',
};

const INSIGHT_WEIGHT_PLATEAU = {
  id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80',
  category: 'weight_plateau' as const,
  title: 'Weight has stalled for 3 weeks',
  body: 'Your weight has remained within 0.3 lbs of 180 lbs for the past 3 weigh-ins despite a target loss of 1 lb/week. A small calorie reduction of 100-150 kcal or an extra 20 minutes of weekly cardio could restart progress.',
  supportingData: {
    metric: 'Weekly Weight Change',
    actual: '-0.05 lbs/week',
    target: '-1.0 lbs/week',
    trend: 'flat for 3 weeks',
  },
  severity: 'action' as const,
  ctaType: 'adjust_macros' as const,
  ctaLabel: 'Adjust Calories',
};

// ============================================================
// Helper to build a valid Claude Message object
// ============================================================

interface MessageOptions {
  id?: string;
  content: ContentBlock[];
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
}

type ContentBlock = TextBlock | ToolUseBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function buildMessage(options: MessageOptions) {
  return {
    id: options.id ?? 'msg_01XFDUDYJgAACzvnptvVoYEL',
    type: 'message' as const,
    role: 'assistant' as const,
    content: options.content,
    model: 'claude-sonnet-4-20250514',
    stop_reason: options.stopReason ?? 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: options.inputTokens ?? 1850,
      output_tokens: options.outputTokens ?? 420,
    },
  };
}

// ============================================================
// VALID_3_RECOMMENDATIONS (happy path - 3 insights)
// ============================================================

export const VALID_3_RECOMMENDATIONS = buildMessage({
  id: 'msg_insights_3_valid',
  content: [
    {
      type: 'text',
      text: 'Based on your tracking data over the past 14 days, here are my top recommendations:',
    },
    {
      type: 'tool_use',
      id: 'toolu_01A1B2C3D4E5F6G7H8I9J0K1',
      name: 'generate_nutrition_insights',
      input: {
        recommendations: [INSIGHT_MACRO_DEFICIENCY, INSIGHT_LOW_ADHERENCE, INSIGHT_POSITIVE_STREAK],
      },
    },
  ],
  inputTokens: 2100,
  outputTokens: 580,
});

// ============================================================
// VALID_2_RECOMMENDATIONS (minimum - 2 insights)
// ============================================================

export const VALID_2_RECOMMENDATIONS = buildMessage({
  id: 'msg_insights_2_valid',
  content: [
    {
      type: 'text',
      text: 'Here are the key patterns I noticed in your recent tracking:',
    },
    {
      type: 'tool_use',
      id: 'toolu_02B3C4D5E6F7G8H9I0J1K2L3',
      name: 'generate_nutrition_insights',
      input: {
        recommendations: [INSIGHT_WEIGHT_PLATEAU, INSIGHT_MACRO_DEFICIENCY],
      },
    },
  ],
  inputTokens: 1950,
  outputTokens: 390,
});

// ============================================================
// TEXT_ONLY_NO_TOOL_USE (failure - no tool_use block)
// ============================================================

export const TEXT_ONLY_NO_TOOL_USE = buildMessage({
  id: 'msg_insights_text_only',
  content: [
    {
      type: 'text',
      text: 'Based on your data, I recommend focusing on increasing protein intake and maintaining better weekend adherence. Your tracking streak is looking good though!',
    },
  ],
  stopReason: 'end_turn',
  inputTokens: 1800,
  outputTokens: 150,
});

// ============================================================
// MALFORMED_TOOL_USE (failure - missing required fields)
// ============================================================

export const MALFORMED_TOOL_USE = buildMessage({
  id: 'msg_insights_malformed',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_03C4D5E6F7G8H9I0J1K2L3M4',
      name: 'generate_nutrition_insights',
      input: {
        recommendations: [
          {
            // Missing id, severity, ctaType, ctaLabel
            category: 'macro_deficiency',
            title: 'Low protein',
            body: 'You need more protein.',
            supportingData: {
              metric: 'Protein',
              actual: '100g',
              // Missing target
            },
          },
          {
            id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8091',
            // Missing category
            title: 'Another insight',
            body: 'Some detail here.',
            supportingData: {
              metric: 'Calories',
              actual: '1800',
              target: '2000',
            },
            severity: 'info',
            ctaType: 'view_trends',
            ctaLabel: 'View',
          },
        ],
      },
    },
  ],
  inputTokens: 1750,
  outputTokens: 280,
});

// ============================================================
// EMPTY_RECOMMENDATIONS (failure - empty array)
// ============================================================

export const EMPTY_RECOMMENDATIONS = buildMessage({
  id: 'msg_insights_empty',
  content: [
    {
      type: 'text',
      text: 'I was unable to generate specific recommendations from the available data.',
    },
    {
      type: 'tool_use',
      id: 'toolu_04D5E6F7G8H9I0J1K2L3M4N5',
      name: 'generate_nutrition_insights',
      input: {
        recommendations: [],
      },
    },
  ],
  inputTokens: 1600,
  outputTokens: 120,
});

// ============================================================
// Error response fixtures (not Message objects - these are API errors)
// ============================================================

export const RATE_LIMIT_ERROR = {
  status: 429,
  error: {
    type: 'rate_limit_error' as const,
    message:
      'Number of request tokens has exceeded your per-minute rate limit (https://docs.anthropic.com/en/api/rate-limits); see the response headers for current usage. Please reduce the prompt length or the maximum tokens requested, or try again later. You may also contact sales at https://www.anthropic.com/contact-sales to discuss your options for a rate limit increase.',
  },
  headers: {
    'retry-after': '30',
    'x-ratelimit-limit-requests': '50',
    'x-ratelimit-limit-tokens': '40000',
    'x-ratelimit-remaining-requests': '0',
    'x-ratelimit-remaining-tokens': '0',
    'x-ratelimit-reset-requests': '2026-02-19T12:00:30Z',
    'x-ratelimit-reset-tokens': '2026-02-19T12:00:30Z',
  },
};

export const OVERLOADED_ERROR = {
  status: 529,
  error: {
    type: 'overloaded_error' as const,
    message: "Anthropic's API is temporarily overloaded. Please try again later.",
  },
  headers: {},
};

// ============================================================
// Re-export individual insight items for granular assertions
// ============================================================

export const INSIGHT_ITEMS = {
  macroDeficiency: INSIGHT_MACRO_DEFICIENCY,
  lowAdherence: INSIGHT_LOW_ADHERENCE,
  positiveStreak: INSIGHT_POSITIVE_STREAK,
  weightPlateau: INSIGHT_WEIGHT_PLATEAU,
} as const;
