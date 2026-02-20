import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { insightItemSchema, insightsArraySchema } from '../schemas';

// ---------------------------------------------------------------------------
// Valid InsightItem fixture used across tests
// ---------------------------------------------------------------------------

function createValidInsightItem() {
  return {
    id: randomUUID(),
    category: 'macro_deficiency' as const,
    title: 'Protein intake consistently low',
    body: 'Over the past 14 days your average protein intake was 112g, which is 38g below your 150g target. Consider adding a protein shake or Greek yogurt snack.',
    supportingData: {
      metric: 'avg_protein_g',
      actual: '112',
      target: '150',
      trend: 'declining',
    },
    severity: 'warning' as const,
    ctaType: 'adjust_macros' as const,
    ctaLabel: 'Adjust Macros',
  };
}

// ---------------------------------------------------------------------------
// insightItemSchema
// ---------------------------------------------------------------------------

describe('insightItemSchema', () => {
  it('accepts a complete valid InsightItem with all fields', () => {
    const item = createValidInsightItem();
    const result = insightItemSchema.safeParse(item);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(item.id);
      expect(result.data.category).toBe('macro_deficiency');
      expect(result.data.title).toBe(item.title);
      expect(result.data.body).toBe(item.body);
      expect(result.data.supportingData.metric).toBe('avg_protein_g');
      expect(result.data.supportingData.trend).toBe('declining');
      expect(result.data.severity).toBe('warning');
      expect(result.data.ctaType).toBe('adjust_macros');
      expect(result.data.ctaLabel).toBe('Adjust Macros');
    }
  });

  it('rejects when title is missing', () => {
    const item = createValidInsightItem();
    const { title: _, ...withoutTitle } = item;

    const result = insightItemSchema.safeParse(withoutTitle);

    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((issue) => issue.path.includes('title'));
      expect(titleError).toBeDefined();
    }
  });

  it('rejects when category is missing', () => {
    const item = createValidInsightItem();
    const { category: _, ...withoutCategory } = item;

    const result = insightItemSchema.safeParse(withoutCategory);

    expect(result.success).toBe(false);
    if (!result.success) {
      const categoryError = result.error.issues.find((issue) => issue.path.includes('category'));
      expect(categoryError).toBeDefined();
    }
  });

  it('rejects when body is missing', () => {
    const item = createValidInsightItem();
    const { body: _, ...withoutBody } = item;

    const result = insightItemSchema.safeParse(withoutBody);

    expect(result.success).toBe(false);
    if (!result.success) {
      const bodyError = result.error.issues.find((issue) => issue.path.includes('body'));
      expect(bodyError).toBeDefined();
    }
  });

  it('rejects an invalid category enum value', () => {
    const item = { ...createValidInsightItem(), category: 'bad_category' };

    const result = insightItemSchema.safeParse(item);

    expect(result.success).toBe(false);
    if (!result.success) {
      const categoryError = result.error.issues.find((issue) => issue.path.includes('category'));
      expect(categoryError).toBeDefined();
    }
  });

  it('rejects an invalid severity enum value', () => {
    const item = { ...createValidInsightItem(), severity: 'critical' };

    const result = insightItemSchema.safeParse(item);

    expect(result.success).toBe(false);
    if (!result.success) {
      const severityError = result.error.issues.find((issue) => issue.path.includes('severity'));
      expect(severityError).toBeDefined();
    }
  });

  it('rejects an invalid ctaType enum value', () => {
    const item = { ...createValidInsightItem(), ctaType: 'delete_account' };

    const result = insightItemSchema.safeParse(item);

    expect(result.success).toBe(false);
    if (!result.success) {
      const ctaError = result.error.issues.find((issue) => issue.path.includes('ctaType'));
      expect(ctaError).toBeDefined();
    }
  });

  it('rejects body exceeding 300 characters', () => {
    const longBody = 'A'.repeat(301);
    const item = { ...createValidInsightItem(), body: longBody };

    const result = insightItemSchema.safeParse(item);

    expect(result.success).toBe(false);
    if (!result.success) {
      const bodyError = result.error.issues.find((issue) => issue.path.includes('body'));
      expect(bodyError).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// insightsArraySchema
// ---------------------------------------------------------------------------

describe('insightsArraySchema', () => {
  it('accepts an array of 2 valid items', () => {
    const items = [createValidInsightItem(), createValidInsightItem()];
    const result = insightsArraySchema.safeParse(items);
    expect(result.success).toBe(true);
  });

  it('accepts an array of 3 valid items', () => {
    const items = [createValidInsightItem(), createValidInsightItem(), createValidInsightItem()];
    const result = insightsArraySchema.safeParse(items);
    expect(result.success).toBe(true);
  });

  it('rejects an empty array (0 items)', () => {
    const result = insightsArraySchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('rejects an array of 1 item', () => {
    const result = insightsArraySchema.safeParse([createValidInsightItem()]);
    expect(result.success).toBe(false);
  });

  it('rejects an array of 4 items', () => {
    const items = Array.from({ length: 4 }, () => createValidInsightItem());
    const result = insightsArraySchema.safeParse(items);
    expect(result.success).toBe(false);
  });
});
