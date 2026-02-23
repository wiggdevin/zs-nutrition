import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { aggregateInsightsData } from '../services/insights-aggregator';
import { generateInsights, generateFallbackInsights } from '../services/insights-generator';
import { insightsLogger, categorizeError, InsightsErrorCategory } from '../utils/insights-logger';
import { logger } from '@/lib/safe-logger';
import type { InsightsResponse } from '@/lib/insights/schemas';
import type { InsightItem } from '@/lib/insights/schemas';

const CACHE_TTL_HOURS = 24;
const MAX_REFRESHES_PER_DAY = 3;
const MIN_DAYS_TRACKED = 3;

export const insightsRouter = router({
  /**
   * Get AI-powered nutrition insights.
   * Uses DB cache with 24h TTL + input hash validation.
   */
  getInsights: protectedProcedure.query(async ({ ctx }): Promise<InsightsResponse> => {
    const pipelineStart = Date.now();
    const userId = ctx.dbUserId;

    try {
      // Aggregate user data
      const { payload, inputHash } = await aggregateInsightsData(ctx.prisma, userId);

      // Minimum data guard
      if (payload.daysTracked < MIN_DAYS_TRACKED) {
        return {
          insights: [],
          generatedAt: new Date().toISOString(),
          fromCache: false,
          insufficientData: true,
          daysTracked: payload.daysTracked,
        };
      }

      // Check DB cache: valid if matching hash AND not expired
      const now = new Date();
      const cached = await ctx.prisma.aiInsight.findFirst({
        where: {
          userId,
          inputHash,
          expiresAt: { gt: now },
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (cached) {
        const ageHours = (now.getTime() - cached.generatedAt.getTime()) / (1000 * 60 * 60);
        insightsLogger.cacheHit(inputHash, ageHours);
        insightsLogger.pipelineComplete(Date.now() - pipelineStart, true);

        return {
          insights: cached.insights as InsightItem[],
          generatedAt: cached.generatedAt.toISOString(),
          fromCache: true,
        };
      }

      // Cache miss — generate fresh insights
      insightsLogger.cacheMiss();

      let insights: InsightItem[];
      let tokenUsage: { inputTokens: number; outputTokens: number };

      try {
        const result = await generateInsights(payload);
        insights = result.insights;
        tokenUsage = result.tokenUsage;
      } catch (err) {
        // Claude failed — use deterministic fallback
        const category = categorizeError(err);
        if (category === InsightsErrorCategory.CLAUDE_AUTH_ERROR) {
          logger.error('[INSIGHTS] Auth error — check ANTHROPIC_API_KEY');
        }
        insights = generateFallbackInsights(payload);
        tokenUsage = { inputTokens: 0, outputTokens: 0 };
      }

      // Store in DB
      const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
      await ctx.prisma.aiInsight.create({
        data: {
          userId,
          insights: insights as unknown as import('@prisma/client').Prisma.InputJsonValue,
          inputHash,
          tokenUsage: tokenUsage as unknown as import('@prisma/client').Prisma.InputJsonValue,
          generatedAt: now,
          expiresAt,
        },
      });

      insightsLogger.pipelineComplete(Date.now() - pipelineStart, false);

      return {
        insights,
        generatedAt: now.toISOString(),
        fromCache: false,
      };
    } catch (err) {
      logger.error('[INSIGHTS] Pipeline error:', err instanceof Error ? err : undefined);
      // Return empty on total failure rather than crashing the dashboard
      return {
        insights: [],
        generatedAt: new Date().toISOString(),
        fromCache: false,
      };
    }
  }),

  /**
   * Force-refresh insights. Rate-limited to 3/day per user.
   */
  refreshInsights: protectedProcedure.mutation(async ({ ctx }): Promise<InsightsResponse> => {
    const pipelineStart = Date.now();
    const userId = ctx.dbUserId;

    // Rate limit: max 3 refreshes per day
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const refreshCount = await ctx.prisma.aiInsight.count({
      where: {
        userId,
        generatedAt: { gte: todayStart },
      },
    });

    if (refreshCount >= MAX_REFRESHES_PER_DAY) {
      insightsLogger.rateLimitExceeded(userId, refreshCount);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Maximum ${MAX_REFRESHES_PER_DAY} insight refreshes per day. Try again tomorrow.`,
      });
    }

    // Aggregate data
    const { payload, inputHash } = await aggregateInsightsData(ctx.prisma, userId);

    // Minimum data guard
    if (payload.daysTracked < MIN_DAYS_TRACKED) {
      return {
        insights: [],
        generatedAt: new Date().toISOString(),
        fromCache: false,
        insufficientData: true,
        daysTracked: payload.daysTracked,
      };
    }

    // Force regenerate (skip cache check)
    insightsLogger.cacheMiss();

    let insights: InsightItem[];
    let tokenUsage: { inputTokens: number; outputTokens: number };

    try {
      const result = await generateInsights(payload);
      insights = result.insights;
      tokenUsage = result.tokenUsage;
    } catch (err) {
      logger.error('[INSIGHTS] generateInsights failed, using fallback insights:', err);
      insights = generateFallbackInsights(payload);
      tokenUsage = { inputTokens: 0, outputTokens: 0 };
    }

    // Store in DB
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await ctx.prisma.aiInsight.create({
      data: {
        userId,
        insights: insights as unknown as import('@prisma/client').Prisma.InputJsonValue,
        inputHash,
        tokenUsage: tokenUsage as unknown as import('@prisma/client').Prisma.InputJsonValue,
        generatedAt: now,
        expiresAt,
      },
    });

    insightsLogger.pipelineComplete(Date.now() - pipelineStart, false);

    return {
      insights,
      generatedAt: now.toISOString(),
      fromCache: false,
    };
  }),
});
