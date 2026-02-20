import { z } from 'zod';

// ============================================================
// Enums
// ============================================================

export const insightCategoryEnum = z.enum([
  'macro_deficiency',
  'overconsumption_pattern',
  'meal_swap_frequency',
  'weight_plateau',
  'low_adherence',
  'unused_plan_meals',
  'recovery_impact',
  'positive_streak',
]);

export const insightSeverityEnum = z.enum(['info', 'warning', 'action']);

export const insightCtaTypeEnum = z.enum([
  'adjust_macros',
  'regenerate_plan',
  'log_weight',
  'view_trends',
  'swap_meals',
  'view_plan',
]);

// ============================================================
// InsightItem schema
// ============================================================

export const insightItemSchema = z.object({
  id: z.string().uuid(),
  category: insightCategoryEnum,
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(300),
  supportingData: z.object({
    metric: z.string(),
    actual: z.string(),
    target: z.string(),
    trend: z.string().optional(),
  }),
  severity: insightSeverityEnum,
  ctaType: insightCtaTypeEnum,
  ctaLabel: z.string().min(1).max(30),
});

export type InsightItem = z.infer<typeof insightItemSchema>;
export type InsightCategory = z.infer<typeof insightCategoryEnum>;
export type InsightSeverity = z.infer<typeof insightSeverityEnum>;
export type InsightCtaType = z.infer<typeof insightCtaTypeEnum>;

// ============================================================
// Insights array (2-3 items)
// ============================================================

export const insightsArraySchema = z.array(insightItemSchema).min(2).max(3);

// ============================================================
// Claude tool_use schema (JSON Schema for tool definition)
// ============================================================

export const claudeInsightsToolSchema = {
  name: 'generate_nutrition_insights',
  description:
    'Generate 2-3 actionable nutrition insights based on user tracking data. Each insight should reference specific numbers and include a clear call to action.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendations: {
        type: 'array' as const,
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'UUID for the insight' },
            category: {
              type: 'string' as const,
              enum: insightCategoryEnum.options,
            },
            title: {
              type: 'string' as const,
              maxLength: 60,
              description: 'Short headline for the insight',
            },
            body: {
              type: 'string' as const,
              maxLength: 300,
              description: 'Natural language explanation with specific numbers',
            },
            supportingData: {
              type: 'object' as const,
              properties: {
                metric: { type: 'string' as const },
                actual: { type: 'string' as const },
                target: { type: 'string' as const },
                trend: { type: 'string' as const },
              },
              required: ['metric', 'actual', 'target'],
            },
            severity: {
              type: 'string' as const,
              enum: insightSeverityEnum.options,
            },
            ctaType: {
              type: 'string' as const,
              enum: insightCtaTypeEnum.options,
            },
            ctaLabel: {
              type: 'string' as const,
              maxLength: 30,
              description: 'Button label for the call to action',
            },
          },
          required: [
            'id',
            'category',
            'title',
            'body',
            'supportingData',
            'severity',
            'ctaType',
            'ctaLabel',
          ],
        },
      },
    },
    required: ['recommendations'],
  },
} as const;

// ============================================================
// Aggregated data payload (sent to Claude)
// ============================================================

export interface InsightsDataPayload {
  // User context
  goalType: string;
  goalRate: number;
  dailyKcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;

  // Tracking stats (14-day window)
  daysTracked: number;
  avgAdherence: number;
  avgCalorieDeficit: number;
  avgProteinGap: number;
  avgCarbsGap: number;
  avgFatGap: number;
  daysWithLowAdherence: number;
  streakDays: number;
  bestDay: string | null;
  worstDay: string | null;

  // Meal tracking
  totalMeals: number;
  planMealPct: number;
  totalSwaps: number;
  frequentlySwappedSlots: string[];

  // Weight
  isPlateau: boolean;
  weightTrendLbsPerWeek: number | null;
  weightEntryCount: number;

  // Activity/Recovery
  avgSleepScore: number | null;
  avgReadinessScore: number | null;
  daysWithPoorSleep: number;
}

// ============================================================
// API response types
// ============================================================

export interface InsightsResponse {
  insights: InsightItem[];
  generatedAt: string;
  fromCache: boolean;
  insufficientData?: boolean;
  daysTracked?: number;
}
